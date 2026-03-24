(function () {
	function getUrlFromCssValue(value) {
		if (!value) {
			return "";
		}
		var match = value.match(/url\((["']?)(.*?)\1\)/i);
		return match && match[2] ? match[2] : "";
	}

	function getImageUrlFromElement(element) {
		if (element.dataset.full) {
			return element.dataset.full;
		}
		var inlineVar = element.style.getPropertyValue("--bgimg");
		var fromInline = getUrlFromCssValue(inlineVar);
		if (fromInline) {
			return fromInline;
		}
		var computed = window.getComputedStyle(element).backgroundImage;
		return getUrlFromCssValue(computed);
	}

	function setupLightbox() {
		var lightbox = document.createElement("div");
		lightbox.className = "image-lightbox";
		lightbox.innerHTML =
			'<div class="lightbox-backdrop" data-close="true"></div>' +
			'<div class="lightbox-toolbar">' +
			'<button type="button" class="lightbox-btn" data-action="zoom-out" aria-label="Zoom out">' +
			'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11h14v2H5z"></path></svg>' +
			'</button>' +
			'<button type="button" class="lightbox-btn" data-action="zoom-in" aria-label="Zoom in">' +
			'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v14h-2zM5 11h14v2H5z"></path></svg>' +
			'</button>' +
			'<button type="button" class="lightbox-btn" data-action="reset" aria-label="Reset zoom">' +
			'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5a7 7 0 1 1-6.65 9.18l1.9-.62A5 5 0 1 0 8 8.4V11H3V6h2v1.4A8.96 8.96 0 0 1 12 5z"></path></svg>' +
			'</button>' +
			'<button type="button" class="lightbox-btn" data-close="true" aria-label="Close image">' +
			'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z"></path></svg>' +
			'</button>' +
			'</div>' +
			'<div class="lightbox-stage">' +
			'<img class="lightbox-image" alt="Expanded artwork" />' +
			'</div>' +
			'';
		document.body.appendChild(lightbox);

		var image = lightbox.querySelector(".lightbox-image");
		var stage = lightbox.querySelector(".lightbox-stage");
		var baseScale = 1;
		var zoom = 1;
		var x = 0;
		var y = 0;
		var dragging = false;
		var pointerId = null;
		var dragStartX = 0;
		var dragStartY = 0;
		var dragOriginX = 0;
		var dragOriginY = 0;
		var suppressNextClick = false;
		var activePointers = new Map();
		var pinchActive = false;
		var pinchDistance = 0;
		var pinchCenterX = 0;
		var pinchCenterY = 0;
		var minZoom = 0.35;
		var maxZoom = 7;
		var imageNaturalWidth = 0;
		var imageNaturalHeight = 0;

		function getPointerDistance(a, b) {
			var dx = a.x - b.x;
			var dy = a.y - b.y;
			return Math.sqrt(dx * dx + dy * dy);
		}

		function getPointerCenter(a, b) {
			return {
				x: (a.x + b.x) / 2,
				y: (a.y + b.y) / 2
			};
		}

		function getContainedScale() {
			var rect = stage.getBoundingClientRect();
			if (!rect.width || !rect.height || !imageNaturalWidth || !imageNaturalHeight) {
				return 1;
			}
			return Math.min(rect.width / imageNaturalWidth, rect.height / imageNaturalHeight);
		}

		function applyTransform() {
			var finalScale = baseScale * zoom;
			image.style.transform = "translate(-50%, -50%) translate(" + x + "px, " + y + "px) scale(" + finalScale + ")";
		}

		function shouldDismiss() {
			var rect = image.getBoundingClientRect();
			var viewportWidth = window.innerWidth;
			var viewportHeight = window.innerHeight;
			var horizontalGap = rect.right < -120 || rect.left > viewportWidth + 120;
			var verticalGap = rect.bottom < -120 || rect.top > viewportHeight + 120;
			return horizontalGap || verticalGap;
		}

		function getStageCenter() {
			var rect = stage.getBoundingClientRect();
			return {
				x: rect.left + rect.width / 2,
				y: rect.top + rect.height / 2
			};
		}

		function setZoom(nextZoom, anchorClientX, anchorClientY) {
			var previousZoom = zoom;
			var previousScale = baseScale * previousZoom;
			var stageCenter = getStageCenter();
			var anchorX = typeof anchorClientX === "number" ? anchorClientX : stageCenter.x;
			var anchorY = typeof anchorClientY === "number" ? anchorClientY : stageCenter.y;
			var imageRect = image.getBoundingClientRect();

			zoom = Math.min(maxZoom, Math.max(minZoom, nextZoom));

			if (previousScale > 0 && imageRect.width && imageRect.height) {
				var nextScale = baseScale * zoom;
				var imageCenterX = imageRect.left + imageRect.width / 2;
				var imageCenterY = imageRect.top + imageRect.height / 2;
				var deltaX = anchorX - imageCenterX;
				var deltaY = anchorY - imageCenterY;
				var ratio = nextScale / previousScale;
				var nextCenterX = anchorX - deltaX * ratio;
				var nextCenterY = anchorY - deltaY * ratio;

				x = nextCenterX - stageCenter.x;
				y = nextCenterY - stageCenter.y;
			}

			if (zoom <= 1) {
				x = 0;
				y = 0;
			}
			applyTransform();
		}

		function resetView() {
			zoom = 1;
			x = 0;
			y = 0;
			applyTransform();
		}

		function refreshBaseScale() {
			baseScale = getContainedScale();
			applyTransform();
		}

		function open(src) {
			image.onload = function () {
				imageNaturalWidth = image.naturalWidth;
				imageNaturalHeight = image.naturalHeight;
				image.style.width = imageNaturalWidth + "px";
				image.style.height = imageNaturalHeight + "px";
				image.draggable = false;
				refreshBaseScale();
				resetView();
			};
			image.src = src;
			lightbox.classList.add("open");
			document.body.classList.add("lightbox-open");
		}

		function close() {
			dragging = false;
			pointerId = null;
			suppressNextClick = false;
			activePointers.clear();
			pinchActive = false;
			pinchDistance = 0;
			lightbox.classList.remove("open");
			document.body.classList.remove("lightbox-open");
			image.removeAttribute("src");
		}

		lightbox.addEventListener("click", function (event) {
			var actionButton = event.target.closest("[data-action], [data-close]");

			if (suppressNextClick) {
				suppressNextClick = false;
				return;
			}

			if (actionButton && actionButton.dataset.close === "true") {
				close();
				return;
			}
			if (event.target === stage) {
				close();
				return;
			}
			if (actionButton && actionButton.dataset.action === "zoom-in") {
				setZoom(zoom * 1.2);
			}
			if (actionButton && actionButton.dataset.action === "zoom-out") {
				setZoom(zoom / 1.2);
			}
			if (actionButton && actionButton.dataset.action === "reset") {
				resetView();
			}
		});

		stage.addEventListener(
			"wheel",
			function (event) {
				event.preventDefault();
				setZoom(zoom * (event.deltaY < 0 ? 1.12 : 0.88), event.clientX, event.clientY);
			},
			{ passive: false }
		);

		image.addEventListener("dragstart", function (event) {
			event.preventDefault();
		});

		stage.addEventListener("pointerdown", function (event) {
			if (event.pointerType === "touch") {
				event.preventDefault();
				activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
				stage.setPointerCapture(event.pointerId);

				if (activePointers.size === 2) {
					var pinchPoints = Array.from(activePointers.values());
					var pinchCenter = getPointerCenter(pinchPoints[0], pinchPoints[1]);
					pinchDistance = getPointerDistance(pinchPoints[0], pinchPoints[1]);
					pinchCenterX = pinchCenter.x;
					pinchCenterY = pinchCenter.y;
					pinchActive = true;
					dragging = false;
					pointerId = null;
					image.classList.remove("dragging");
					return;
				}

				if (activePointers.size === 1 && event.target === image) {
					dragging = true;
					pointerId = event.pointerId;
					dragStartX = event.clientX;
					dragStartY = event.clientY;
					dragOriginX = x;
					dragOriginY = y;
					suppressNextClick = false;
					image.classList.add("dragging");
				}
				return;
			}

			if (event.button !== 0) {
				return;
			}
			if (event.target !== image) {
				return;
			}
			event.preventDefault();
			dragging = true;
			suppressNextClick = false;
			pointerId = event.pointerId;
			dragStartX = event.clientX;
			dragStartY = event.clientY;
			dragOriginX = x;
			dragOriginY = y;
			stage.setPointerCapture(pointerId);
			image.classList.add("dragging");
		});

		stage.addEventListener("pointermove", function (event) {
			if (event.pointerType === "touch") {
				if (!activePointers.has(event.pointerId)) {
					return;
				}
				activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

				if (pinchActive && activePointers.size >= 2) {
					event.preventDefault();
					var points = Array.from(activePointers.values());
					var center = getPointerCenter(points[0], points[1]);
					var distance = getPointerDistance(points[0], points[1]);

					if (distance > 0 && pinchDistance > 0) {
						setZoom(zoom * (distance / pinchDistance), center.x, center.y);
					}

					x += center.x - pinchCenterX;
					y += center.y - pinchCenterY;
					applyTransform();
					pinchDistance = distance;
					pinchCenterX = center.x;
					pinchCenterY = center.y;
					suppressNextClick = true;

					if (shouldDismiss()) {
						close();
					}
					return;
				}

				if (!dragging || event.pointerId !== pointerId) {
					return;
				}

				event.preventDefault();
				if (Math.abs(event.clientX - dragStartX) > 4 || Math.abs(event.clientY - dragStartY) > 4) {
					suppressNextClick = true;
				}
				x = dragOriginX + (event.clientX - dragStartX);
				y = dragOriginY + (event.clientY - dragStartY);
				applyTransform();
				if (shouldDismiss()) {
					close();
				}
				return;
			}

			if (!dragging || event.pointerId !== pointerId) {
				return;
			}
			event.preventDefault();
			if (Math.abs(event.clientX - dragStartX) > 4 || Math.abs(event.clientY - dragStartY) > 4) {
				suppressNextClick = true;
			}
			x = dragOriginX + (event.clientX - dragStartX);
			y = dragOriginY + (event.clientY - dragStartY);
			applyTransform();
			if (shouldDismiss()) {
				close();
			}
		});

		function endDrag(event) {
			if (event && event.pointerType === "touch") {
				if (activePointers.has(event.pointerId)) {
					activePointers.delete(event.pointerId);
				}
				if (stage.hasPointerCapture(event.pointerId)) {
					stage.releasePointerCapture(event.pointerId);
				}

				if (activePointers.size < 2) {
					pinchActive = false;
					pinchDistance = 0;
				}

				if (event.pointerId === pointerId || activePointers.size === 0) {
					dragging = false;
					pointerId = null;
					image.classList.remove("dragging");
				}
				return;
			}

			if (event && pointerId !== null && event.pointerId !== pointerId) {
				return;
			}
			if (pointerId !== null && stage.hasPointerCapture(pointerId)) {
				stage.releasePointerCapture(pointerId);
			}
			dragging = false;
			pointerId = null;
			image.classList.remove("dragging");
		}

		stage.addEventListener("pointerup", endDrag);
		stage.addEventListener("pointercancel", endDrag);
		stage.addEventListener("lostpointercapture", endDrag);

		document.addEventListener("keydown", function (event) {
			if (!lightbox.classList.contains("open")) {
				return;
			}
			if (event.key === "Escape") {
				close();
			}
			if (event.key === "+" || event.key === "=") {
				setZoom(zoom * 1.15);
			}
			if (event.key === "-") {
				setZoom(zoom / 1.15);
			}
		});

		window.addEventListener("resize", function () {
			if (!lightbox.classList.contains("open")) {
				return;
			}
			refreshBaseScale();
			if (shouldDismiss()) {
				close();
			}
		});

		return { open: open };
	}

	document.addEventListener("DOMContentLoaded", function () {
		var lightbox = setupLightbox();
		var zoomables = document.querySelectorAll(".gallery-cell, .zoomable-image");
		var lastLightboxOpenAt = 0;

		function openZoomableElement(element) {
			if (!element) {
				return;
			}
			var source = getImageUrlFromElement(element);
			if (!source) {
				return;
			}
			var now = Date.now();
			if (now - lastLightboxOpenAt < 220) {
				return;
			}
			lastLightboxOpenAt = now;
			lightbox.open(source);
		}

		zoomables.forEach(function (element) {
			var source = getImageUrlFromElement(element);
			if (!source) {
				return;
			}
			element.setAttribute("role", "button");
			element.setAttribute("tabindex", "0");
			element.classList.add("is-zoomable");

			if (element.closest(".js-flickity")) {
				return;
			}

			function openFromElement() {
				openZoomableElement(element);
			}

			element.addEventListener("click", openFromElement);
			element.addEventListener("keydown", function (event) {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					openFromElement();
				}
			});
		});
		document.querySelectorAll(".js-flickity").forEach(function (flkEl) {
			var tapPointerId = null;
			var tapStartX = 0;
			var tapStartY = 0;
			var tapStartAt = 0;
			var tapMoved = false;
			var suppressClickUntil = 0;

			flkEl.addEventListener("pointerdown", function (event) {
				if (!event.isPrimary) {
					return;
				}
				tapPointerId = event.pointerId;
				tapStartX = event.clientX;
				tapStartY = event.clientY;
				tapStartAt = Date.now();
				tapMoved = false;
			});

			flkEl.addEventListener("pointermove", function (event) {
				if (event.pointerId !== tapPointerId) {
					return;
				}
				if (Math.abs(event.clientX - tapStartX) > 10 || Math.abs(event.clientY - tapStartY) > 10) {
					tapMoved = true;
				}
			});

			flkEl.addEventListener("pointerup", function (event) {
				if (event.pointerId !== tapPointerId) {
					return;
				}
				var elapsed = Date.now() - tapStartAt;
				var movedX = Math.abs(event.clientX - tapStartX);
				var movedY = Math.abs(event.clientY - tapStartY);
				tapPointerId = null;

				if (tapMoved || elapsed > 420 || movedX > 10 || movedY > 10) {
					suppressClickUntil = Date.now() + 260;
					return;
				}

				if (event.pointerType !== "touch") {
					return;
				}

				var tappedCell = event.target.closest(".gallery-cell");
				if (tappedCell && flkEl.contains(tappedCell)) {
					openZoomableElement(tappedCell);
				}
			});

			flkEl.addEventListener("pointercancel", function () {
				tapPointerId = null;
				tapMoved = false;
			});

			flkEl.addEventListener("click", function (event) {
				if (Date.now() < suppressClickUntil) {
					return;
				}
				var clickedCell = event.target.closest(".gallery-cell");
				if (clickedCell && flkEl.contains(clickedCell)) {
					openZoomableElement(clickedCell);
				}
			});

			flkEl.addEventListener("staticClick", function (event) {
				var detail = event.detail;
				var cellElement = null;
				if (Array.isArray(detail)) {
					cellElement = detail[1] || detail[0] || null;
				} else if (detail && detail.cellElement) {
					cellElement = detail.cellElement;
				}
				if (!cellElement && event.target) {
					cellElement = event.target.closest(".gallery-cell");
				}
				if (!cellElement) {
					return;
				}
				openZoomableElement(cellElement);
			});
		});
	});
})();
class SiteFooter extends HTMLElement {
	connectedCallback() {
		this.innerHTML =
			'<footer class="site-footer">' +
			'<div class="footer-content">' +
			'<p class="footer-note">&copy; 2026 Inkp0ne\'s Attic</p>' +
			'<ul class="credit-list">' +
			'<li><a href="https://github.com/SagiriHimoto" target="_blank" rel="noopener noreferrer">SagiriHimoto</a></li>' +
			// '<li><a href="https://panzi.github.io/Browser-Ponies/" target="_blank" rel="noopener noreferrer">Browser Ponies</a></li>' +
			'<li><a href="https://flickity.metafizzy.co/" target="_blank" rel="noopener noreferrer">Flickity</a></li>' +
			'<li><a href="https://simpleicons.org/" target="_blank" rel="noopener noreferrer">Simple Icons</a></li>' +
			'</ul>' +
			'</div>' +
			'</footer>';
	}
}
customElements.define('ink-footer', SiteFooter);
class ColorBox extends HTMLElement {
	connectedCallback() {
		var color = this.dataset.color || "#000000";
		var colorName = this.dataset.name || "color";
		this.style.setProperty("--box-color", color);
		this.setAttribute("title", colorName + " - (" + color + ")");
		this.innerHTML = '<div class="color-box"></div><span>' + colorName + ' (' + color + ')</span><button type="button" style="float: right; padding: 0px 4px;" class="btn" aria-label="Copy ' + color + ' to clipboard" onclick="copyText(\'' + color + '\')">Copy</button>';
	}
}
customElements.define('color-box', ColorBox);

var coll = document.getElementsByClassName("collapsible");
var i;

function toggleCollapsibleSection(trigger, content) {
	var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	var isExpanded = trigger.classList.contains("active");

	if (prefersReducedMotion) {
		if (isExpanded) {
			trigger.classList.remove("active");
			trigger.setAttribute("aria-expanded", "false");
			content.classList.remove("is-open");
			content.hidden = true;
			content.style.height = "0px";
		} else {
			trigger.classList.add("active");
			trigger.setAttribute("aria-expanded", "true");
			content.hidden = false;
			content.classList.add("is-open");
			content.style.height = "auto";
		}
		return;
	}

	if (isExpanded) {
		trigger.classList.remove("active");
		trigger.setAttribute("aria-expanded", "false");
		content.style.height = content.scrollHeight + "px";
		content.classList.remove("is-open");
		void content.offsetHeight;
		content.style.height = "0px";

		function onCollapseEnd(event) {
			if (event.propertyName !== "height") {
				return;
			}
			content.hidden = true;
			content.removeEventListener("transitionend", onCollapseEnd);
		}

		content.addEventListener("transitionend", onCollapseEnd);
		return;
	}

	trigger.classList.add("active");
	trigger.setAttribute("aria-expanded", "true");
	content.hidden = false;
	content.style.height = "0px";
	void content.offsetHeight;
	content.classList.add("is-open");
	content.style.height = content.scrollHeight + "px";

	function onExpandEnd(event) {
		if (event.propertyName !== "height") {
			return;
		}
		content.style.height = "auto";
		content.removeEventListener("transitionend", onExpandEnd);
	}

	content.addEventListener("transitionend", onExpandEnd);
}

for (i = 0; i < coll.length; i++) {
	var trigger = coll[i];
	var content = trigger.nextElementSibling;
	if (!content) {
		continue;
	}
	trigger.setAttribute("aria-expanded", "false");
	content.hidden = true;
	content.style.height = "0px";

	trigger.addEventListener("click", function () {
		toggleCollapsibleSection(this, this.nextElementSibling);
	});
}
function copyText(text) {
	navigator.clipboard.writeText(text).then(() => {
	}).catch(err => {
	console.error('Could not copy text: ', err);
	});
}