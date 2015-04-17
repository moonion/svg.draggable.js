( function (root, factory) {
    // UMD wrapper
    if (typeof define === 'function' && define.amd) {
        // AMD
        define(['svg.core'], factory);
    } else if (typeof exports !== 'undefined') {
        // Node/CommonJS
        module.exports = factory(require('svg.core'));
    } else {
        // Browser globals
        factory(root.SVG);
    }
}(this, function (SVG) {
    SVG.extend(SVG.Element, {
        // Make element draggable
        // Constraint might be a object (as described in readme.md) or a function in the form "function (x, y)" that gets called before every move.
        // The function can return a boolean or a object of the form {x, y}, to which the element will be moved. "False" skips moving, true moves to raw x, y.
        draggable: function(constraint) {
            var start, drag, end, element = this;

            // Remove draggable if already present
            if (typeof this.fixed === "function") {
                this.fixed();
            }

            // Ensure constraint object
            constraint = constraint || {};

            // Start dragging
            start = function(event) {
                var parent = this.parent._parent(SVG.Nested) || this._parent(SVG.Doc);
                event = event || window.event;

                // Invoke any callbacks
                if (element.beforedrag) {
                    element.beforedrag(event);
                }

                // Get element bounding box
                var box = element.bbox();

                if (element instanceof SVG.G) {
                    box.x = element.x();
                    box.y = element.y();
                } else if (element instanceof SVG.Nested) {
                    box = {
                        x: element.x(),
                        y: element.y(),
                        width: element.width(),
                        height: element.height()
                    };
                }

                // Store event
                element.startEvent = event;

                // Store start position
                element.startPosition = {
                    x: box.x,
                    y: box.y,
                    width: box.width,
                    height: box.height,
                    zoom: parent.viewbox().zoom,
                    rotation: element.transform("rotation") * Math.PI / 180
                };

                // Add while and end events to window
                SVG.on(window, "mousemove", drag);
                SVG.on(window, "touchmove", drag);

                SVG.on(window, "mouseup", end);
                SVG.on(window, "touchend", end);

                // Invoke any callbacks
                element.node.dispatchEvent(new CustomEvent("dragstart", { detail: { event: event, delta: { x: 0, y: 0 } }}));

                // Prevent selection dragging
                if (event.preventDefault) {
                    event.preventDefault();
                } else {
                    event.returnValue = false;
                }

            };

            function elmZoom(elm) {
                if (!elm || typeof elm.transform !== "function") { return { x: 1, y: 1 }; }
                var p = elm.parent;
                var t = elm.transform();
                pz = {};
                var pz = elmZoom(p);
                return {
                    x: t.scaleX * pz.x,
                    y: t.scaleY * pz.y
                };
            }

            // While dragging
            drag = function(event) {
                event = event || window.event;

                if (element.startEvent) {
                    // Calculate move position
                    var x, y, rotation = element.startPosition.rotation,
                        width = element.startPosition.width,
                        height = element.startPosition.height,
                        delta = {
                            x: event.pageX - element.startEvent.pageX,
                            y: event.pageY - element.startEvent.pageY
                        };

                    if (/^touchstart|touchmove$/.test(event.type)) {
                        delta.x = event.touches[0].pageX - element.startEvent.touches[0].pageX;
                        delta.y = event.touches[0].pageY - element.startEvent.touches[0].pageY;
                    } else if(/^click|mousedown|mousemove$/.test(event.type)) {
                        delta.x = event.pageX - element.startEvent.pageX;
                        delta.y = event.pageY - element.startEvent.pageY;
                    }

                    delta.scale = elmZoom(element);

                    x = element.startPosition.x + (delta.x * Math.cos(rotation) + delta.y * Math.sin(rotation)) / Math.pow(delta.scale.x, 2);
                    y = element.startPosition.y + (delta.y * Math.cos(rotation) + delta.x * Math.sin(-rotation)) / Math.pow(delta.scale.y, 2);

                    // Move the element to its new position, if possible by constraint
                    if (typeof constraint === "function") {
                        var coord = constraint(x, y);

                        if (typeof coord === "object") {
                            if (typeof coord.x !== "boolean" || coord.x) {
                                element.x(typeof coord.x === "number" ? coord.x : x);
                            } else if (typeof coord.y !== "boolean" || coord.y) {
                                element.y(typeof coord.y === "number" ? coord.y : y);
                            }
                        } else if (typeof coord === "boolean" && coord) {
                            element.move(x, y);
                        }

                    } else if (typeof constraint === "object") {
                        // Keep element within constrained box
                        if (constraint.minX !== null && x < constraint.minX) {
                            x = constraint.minX;
                        } else if (constraint.maxX !== null && x > constraint.maxX - width) {
                            x = constraint.maxX - width;
                        }

                        if (constraint.minY !== null && y < constraint.minY) {
                            y = constraint.minY;
                        } else if (constraint.maxY !== null && y > constraint.maxY - height) {
                            y = constraint.maxY - height;
                        }

                        element.move(x, y);
                    }

                    // Invoke any callbacks
                    element.node.dispatchEvent(new CustomEvent("dragmove", { detail: { delta: delta, event: event } }));
                }
            };

            // When dragging ends
            end = function(event) {
                event = event || window.event;

                // Calculate move position
                var delta = {
                    x: event.pageX - element.startEvent.pageX,
                    y: event.pageY - element.startEvent.pageY,
                    zoom: element.startPosition.zoom
                };

                // Reset store
                element.startEvent = null;
                element.startPosition = null;

                // Remove while and end events to window
                SVG.off(window, "mousemove", drag);
                SVG.off(window, "touchmove", drag);
                SVG.off(window, "mouseup", end);
                SVG.off(window, "touchend", end);

                // Invoke any callbacks
                element.node.dispatchEvent(new CustomEvent("dragend", { detail: { delta: { x: 0, y: 0 }, event: event }}));
            };

            // Bind mousedown event
            element.on("mousedown", start);
            element.on("touchstart", start);

            // Disable draggable
            element.fixed = function() {
                element.off("mousedown", start);
                element.off("touchstart", start);

                SVG.off(window, "mousemove", drag);
                SVG.off(window, "touchmove", drag);
                SVG.off(window, "mouseup", end);
                SVG.off(window, "touchend", end);

                start = drag = end = null;

                return element;
            };

            return this;
        }
    });
return SVG;
}));
