/*
* Copyright 2015-2017 WorldWind Contributors
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
* http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
 * @exports ShapeEditor
 */
define([
        '../geom/Angle',
        '../shapes/Annotation',
        '../shapes/AnnotationAttributes',
        '../error/ArgumentError',
        '../util/Color',
        '../util/Font',
        '../util/Insets',
        '../geom/Location',
        '../util/Logger',
        '../shapes/Path',
        '../shapes/Placemark',
        '../shapes/PlacemarkAttributes',
        '../geom/Position',
        '../layer/RenderableLayer',
        '../shapes/ShapeAttributes',
        '../shapes/SurfaceEllipse',
        '../shapes/SurfaceCircle',
        '../shapes/SurfacePolygon',
        '../shapes/SurfacePolyline',
        '../shapes/SurfaceRectangle',
        '../shapes/SurfaceShape',
        '../geom/Vec2',
        '../geom/Vec3'
    ],
    function (Angle,
              Annotation,
              AnnotationAttributes,
              ArgumentError,
              Color,
              Font,
              Insets,
              Location,
              Logger,
              Path,
              Placemark,
              PlacemarkAttributes,
              Position,
              RenderableLayer,
              ShapeAttributes,
              SurfaceEllipse,
              SurfaceCircle,
              SurfacePolygon,
              SurfacePolyline,
              SurfaceRectangle,
              SurfaceShape,
              Vec2,
              Vec3) {
        "use strict";

        /**
         * @alias ShapeEditor
         * @constructor
         * @classdesc Provides a user interface for editing a shape and performs editing. Depending on the shape type,
         * the shape is shown with control points for vertex locations and size. All shapes are shown with a handle that
         * provides rotation.
         * <p/>
         * Drag on the shape's body moves the whole shape. Drag on a control point performs the action
         * associated with that control point. The editor provides vertex insertion and removal for SurfacePolygon and
         * SurfacePolyline. Shift-click when the cursor is over the shape inserts a control
         * point at the cursor's position. Alt-click when the cursor is over a control point removes that control point.
         * <p/>
         * This editor supports all surface shapes except SurfaceImage.
         * @param {WorldWindow} worldWindow The World Window to associate this shape editor controller with.
         * @throws {ArgumentError} If the specified world window is null or undefined.
         */
        var ShapeEditor = function (worldWindow, shape) {
            if (!worldWindow) {
                throw new ArgumentError(Logger.logMessage(Logger.LEVEL_SEVERE, "ShapeEditor", "constructor",
                    "missingWorldWindow"));
            }

            /**
             * The World Window associated with the shape editor controller.
             * @type {WorldWindow}
             */
            this.worldWindow = worldWindow;

            /**
             * The shape associated with the editor.
             * @type {Object}
             */
            this.shape = shape;

            /**
             * The layer holding the editor's control points.
             * @type {RenderableLayer}
             */
            this.controlPointLayer = new RenderableLayer();

            /**
             * The layer holding the rotation line.
             * @type {RenderableLayer}
             */
            this.accessoryLayer = new RenderableLayer();
            this.accessoryLayer.pickEnabled = false;

            /**
             * The layer holding the control point's annotation.
             * @type {RenderableLayer}
             */
            this.annotationLayer = new RenderableLayer();
            this.annotationLayer.pickEnabled = false;

            /**
             * The layer holding a shadow copy of the shape while the shape is being moved or sized.
             * @type {RenderableLayer}
             */
            this.shadowLayer = new RenderableLayer();
            this.shadowLayer.pickEnabled = false;

            /**
             * The control point annotation.
             * @type {Annotation}
             */
            this.annotation = null;

            /**
             * Indicates whether the editor is ready for editing.
             * @type {boolean}
             */
            this.armed = false;

            /**
             * Indicates whether the editor is in the midst of an editing operation.
             * @type {boolean}
             */
            this.active = false;

            /**
             * The terrain position associated with the cursor during the just previous drag event.
             * @type {Position}
             */
            this.previousPosition = null;

            /**
             * The placemark associated with the current sizing operation.
             * @type {Placemark}
             */
            this.currentSizingMarker = null;

            /**
             * The attributes associated with the shape when the editor is constructed. These are swapped out during
             * editing operations in order to make the shape semi-transparent.
             * @type {ShapeAttributes}
             */
            this.originalAttributes = new ShapeAttributes(null);

            /**
             * The highlight attributes associated with the shape when the editor is constructed. These are swapped out
             * during editing operations in order to make the shape semi-transparent.
             * @type {ShapeAttributes}
             */
            this.originalHighlightAttributes = new ShapeAttributes(null);

            /**
             * For shapes without an inherent heading, the current heading established by the editor for the shape.
             * @type {number}
             */
            this.currentHeading = 0;

            /**
             * Attributes used to represent shape vertices.
             * @type {PlacemarkAttributes}
             */
            this.locationControlPointAttributes = new PlacemarkAttributes(null);

            /**
             * Attributes used to represent shape size.
             * @type {PlacemarkAttributes}
             */
            this.sizeControlPointAttributes = new PlacemarkAttributes(null);

            /**
             * Attributes used to represent shape rotation.
             * @type {PlacemarkAttributes}
             */
            this.angleControlPointAttributes = new PlacemarkAttributes(null);

            this.makeControlPointAttributes();

            this.makeAnnotation();

            //Internal use only. Intentionally not documented.
            this.isDragging = false;

            //Internal use only. Intentionally not documented.
            this.startX = null;

            //Internal use only. Intentionally not documented.
            this.startY = null;

            //Internal use only. Intentionally not documented.
            this.lastX = null;

            //Internal use only. Intentionally not documented.
            this.lastY = null;

            //Internal use only. Intentionally not documented.
            this.currentEvent = null;

            this.worldWindow.worldWindowController.addGestureListener(this);
        };

        //Internal use only. Intentionally not documented.
        ShapeEditor.prototype.handleMouseMove = function (event) {
            var shapeEditor = this;

            if(this.shape === null)
                return;

            if (shapeEditor.isDragging === false) {
                return;
            }

            var mousePoint = shapeEditor.worldWindow.canvasCoordinates(event.clientX, event.clientY);
            var terrainObject;

            if (shapeEditor.worldWindow.viewport.containsPoint(mousePoint)) {
                terrainObject = shapeEditor.worldWindow.pickTerrain(mousePoint).terrainObject();
            }

            if (!terrainObject) {
                return;
            }

            if (shapeEditor.currentSizingMarker instanceof Placemark &&
                shapeEditor.currentSizingMarker.userProperties.isControlPoint) {
                shapeEditor.reshapeShape(terrainObject);
                shapeEditor.updateControlPoints();
            }
            else if (shapeEditor.shape instanceof SurfaceShape) {
                shapeEditor.dragWholeShape(event);
                shapeEditor.updateControlPoints();
                shapeEditor.updateShapeAnnotation();
            }

            event.preventDefault();
        };

        //Internal use only. Intentionally not documented.
        ShapeEditor.prototype.handleMouseDown = function (event) {
            var shapeEditor = this;

            if(this.shape === null)
                return;

            shapeEditor.currentEvent = event;

            var x = event.clientX,
                y = event.clientY;

            shapeEditor.startX = x;
            shapeEditor.startY = y;
            shapeEditor.lastX = x;
            shapeEditor.lastY = y;

            var pickList = shapeEditor.worldWindow.pick(shapeEditor.worldWindow.canvasCoordinates(x, y));

            if (pickList.objects.length > 0) {
                for (var p = 0; p < pickList.objects.length; p++) {
                    if (!pickList.objects[p].isTerrain) {
                        if (shapeEditor.shape && pickList.objects[p].userObject === shapeEditor.shape) {
                            event.preventDefault();
                            shapeEditor.isDragging = true;
                            shapeEditor.originalAttributes = shapeEditor.shape.attributes;
                            shapeEditor.originalHighlightAttributes = shapeEditor.shape.highlightAttributes;
                            shapeEditor.makeShadowShape();

                            //set previous position
                            shapeEditor.setPreviousPosition(event);
                        }
                        else if (pickList.objects[p].userObject instanceof Placemark &&
                            pickList.objects[p].userObject.userProperties.isControlPoint) {
                            event.preventDefault();
                            shapeEditor.currentSizingMarker = pickList.objects[p].userObject;
                            shapeEditor.isDragging = true;
                            shapeEditor.originalAttributes = shapeEditor.shape.attributes;
                            shapeEditor.originalHighlightAttributes = shapeEditor.shape.highlightAttributes;
                            shapeEditor.makeShadowShape();

                            //set previous position
                            shapeEditor.setPreviousPosition(event);
                        }
                    }
                }
            }
        };

        //Internal use only. Intentionally not documented.
        ShapeEditor.prototype.handleMouseUp = function (event) {
            var shapeEditor = this;

            if(this.shape === null)
                return;

            var x = event.clientX,
                y = event.clientY;

            if (shapeEditor.shape && shapeEditor.shadowLayer.renderables.length > 0) {
                shapeEditor.removeShadowShape();
                shapeEditor.updateAnnotation(null);
            }

            if (shapeEditor.currentSizingMarker instanceof Placemark &&
                shapeEditor.currentSizingMarker.userProperties.isControlPoint) {
                if (event.altKey) {
                    var mousePoint = shapeEditor.worldWindow.canvasCoordinates(event.clientX, event.clientY);
                    var terrainObject;

                    if (shapeEditor.worldWindow.viewport.containsPoint(mousePoint)) {
                        terrainObject = shapeEditor.worldWindow.pickTerrain(mousePoint).terrainObject();
                    }

                    if (terrainObject) {
                        shapeEditor.reshapeShape(terrainObject);
                        shapeEditor.updateControlPoints();
                        shapeEditor.updateAnnotation(null);
                    }
                }
                shapeEditor.isDragging = false;
                shapeEditor.currentSizingMarker = null;
                return;
            }

            var redrawRequired = false;

            var pickList = shapeEditor.worldWindow.pick(shapeEditor.worldWindow.canvasCoordinates(x, y));
            if (pickList.objects.length > 0) {
                for (var p = 0; p < pickList.objects.length; p++) {
                    if (!pickList.objects[p].isTerrain) {
                        if (shapeEditor.startX === shapeEditor.lastX &&
                            shapeEditor.startY === shapeEditor.lastY) {
                            if (event.shiftKey) {
                                var mousePoint = shapeEditor.worldWindow.canvasCoordinates(event.clientX,
                                    event.clientY);
                                var terrainObject;

                                if (shapeEditor.worldWindow.viewport.containsPoint(mousePoint)) {
                                    terrainObject = shapeEditor.worldWindow.pickTerrain(mousePoint)
                                        .terrainObject();
                                }

                                if (terrainObject) {
                                    shapeEditor.addNearestLocation(terrainObject.position, 0,
                                        shapeEditor.shape.boundaries);
                                }
                            }
                        }

                        redrawRequired = true;
                        break;
                    }
                }
            }

            shapeEditor.isDragging = false;
            shapeEditor.currentSizingMarker = null;

            // Update the window if we changed anything.
            if (redrawRequired) {
                shapeEditor.worldWindow.redraw();
            }
        };

        //Internal use only. Intentionally not documented.
        ShapeEditor.prototype.onGestureEvent = function (event) {
            if (!this.armed) {
                return;
            }

            try {
                if (event.type === "pointerup" || event.type === "mouseup") {
                    this.handleMouseUp(event);
                } else if (event.type === "pointerdown" || event.type === "mousedown") {
                    this.handleMouseDown(event);
                } else if (event.type === "pointermove" || event.type === "mousemove") {
                    this.handleMouseMove(event);
                } else {
                    Logger.logMessage(Logger.LEVEL_INFO, "ShapeEditor", "handleEvent",
                        "Unrecognized event type: " + event.type);
                }
            } catch (event) {
                Logger.logMessage(Logger.LEVEL_SEVERE, "ShapeEditor", "handleEvent",
                    "Error handling event.\n" + event.toString());
            }
        };

        /**
         * Remove the control points.
         */
        ShapeEditor.prototype.removeControlPoints = function () {
            this.controlPointLayer.removeAllRenderables();
        };

        /**
         * Creates and returns the stationary shape displayed during editing operations.
         * @returns {SurfaceShape} The new shadow shape created, or null if the shape type is not recognized.
         */
        ShapeEditor.prototype.doMakeShadowShape = function () {
            if (this.shape && this.shape instanceof SurfacePolygon) {
                return new SurfacePolygon(
                    this.shape.boundaries,
                    this.shape.attributes);
            } else if (this.shape && this.shape instanceof SurfaceEllipse) {
                return new SurfaceEllipse(
                    this.shape.center,
                    this.shape.majorRadius,
                    this.shape.minorRadius,
                    this.shape.heading,
                    this.shape.attributes);
            } else if (this.shape && this.shape instanceof SurfaceCircle) {
                return new SurfaceCircle(
                    this.shape.center,
                    this.shape.radius,
                    this.shape.attributes);
            } else if (this.shape && this.shape instanceof SurfaceRectangle) {
                return new SurfaceRectangle(
                    this.shape.center,
                    this.shape.width,
                    this.shape.height,
                    this.shape.heading,
                    this.shape.attributes);
            } else if (this.shape && this.shape instanceof SurfacePolyline) {
                return new SurfacePolyline(
                    this.shape.boundaries,
                    this.shape.attributes
                );
            }

            return null;
        };

        /**
         * Creates the shape that will remain at the same location and is the same size as the shape to be edited.
         */
        ShapeEditor.prototype.makeShadowShape = function () {
            var shadowShape = this.doMakeShadowShape();
            if (shadowShape == null) {
                return;
            }

            var editingAttributes = new ShapeAttributes(this.originalHighlightAttributes);

            if (editingAttributes.interiorColor.alpha === 1) {
                editingAttributes.interiorColor.alpha = 0.7;
            }

            this.shape.highlightAttributes = editingAttributes;

            shadowShape.highlighted = true;
            shadowShape.highlightAttributes = new ShapeAttributes(this.originalHighlightAttributes);

            this.shadowLayer.addRenderable(shadowShape);
            this.worldWindow.redraw();
        };

        /**
         * Remove the shadow shape.
         */
        ShapeEditor.prototype.removeShadowShape = function () {
            this.shadowLayer.removeAllRenderables();

            // Restore the original highlight attributes.
            this.shape.highlightAttributes = this.originalHighlightAttributes;

            this.worldWindow.redraw();
        };

        /**
         * Set up the Annotation.
         */
        ShapeEditor.prototype.makeAnnotation = function () {
            var annotationAttributes = new AnnotationAttributes(null);
            annotationAttributes.altitudeMode = WorldWind.CLAMP_TO_GROUND;
            annotationAttributes.cornerRadius = 5;
            annotationAttributes.backgroundColor = new Color(0.67, 0.67, 0.67, 0.8);
            annotationAttributes._leaderGapHeight = 0;
            annotationAttributes.drawLeader = false;
            annotationAttributes.scale = 1;
            annotationAttributes._textAttributes.color = Color.BLACK;
            annotationAttributes._textAttributes.font = new Font(10);
            annotationAttributes.insets = new Insets(5, 5, 5, 5);

            this.annotation = new WorldWind.Annotation(
                new WorldWind.Position(0, 0, 0), annotationAttributes);
            this.annotation.text = "";
            this.annotationLayer.addRenderable(this.annotation);
            this.annotationLayer.enabled = false;
        };

        /**
         * Updates the annotation indicating the edited shape's center. If the  shape has no designated center, this
         * method prevents the annotation from displaying.
         */
        ShapeEditor.prototype.updateShapeAnnotation = function () {
            var center = this.getShapeCenter();

            if (center != null) {
                var dummyMarker = new Placemark(
                    new Position(center.latitude, center.longitude, 0),
                    null);
                dummyMarker.userProperties.isControlPoint = true;
                dummyMarker.userProperties.id = 0;
                dummyMarker.userProperties.purpose = ShapeEditor.ANNOTATION;
                this.updateAnnotation(dummyMarker);
            }
            else {
                this.updateAnnotation(null);
            }
        };

        /**
         * Remove the annotation.
         */
        ShapeEditor.prototype.removeAnnotation = function () {
            this.annotationLayer.removeAllRenderables();
        };

        ShapeEditor.prototype.makeControlPointAttributes = function () {
            this.locationControlPointAttributes.imageColor = WorldWind.Color.BLUE;
            this.locationControlPointAttributes.imageScale = 6;

            this.sizeControlPointAttributes.imageColor = WorldWind.Color.CYAN;
            this.sizeControlPointAttributes.imageScale = 6;

            this.angleControlPointAttributes.imageColor = WorldWind.Color.GREEN;
            this.angleControlPointAttributes.imageScale = 6;
        };

        ShapeEditor.prototype.setArmed = function (armed) {
            if (!this.armed && armed) {
                this.enable();
            }
            else if (this.armed && !armed) {
                this.disable();
                this.shape = null;
            }

            this.armed = armed;
        };

        ShapeEditor.prototype.enable = function () {
            if (this.worldWindow.indexOfLayer(this.controlPointLayer) == -1) {
                this.worldWindow.addLayer(this.controlPointLayer);
            }

            if (this.worldWindow.indexOfLayer(this.accessoryLayer) == -1) {
                this.worldWindow.addLayer(this.accessoryLayer);
            }
            this.makeAccessory();

            if (this.worldWindow.indexOfLayer(this.annotationLayer) == -1) {
                this.worldWindow.addLayer(this.annotationLayer);
            }

            if (this.worldWindow.indexOfLayer(this.shadowLayer) == -1) {
                this.worldWindow.insertLayer(0, this.shadowLayer);
            }

            this.updateControlPoints();
        };

        /**
         * Called by {@link ShapeEditorController#setArmed} to remove resources no longer needed after editing.
         */
        ShapeEditor.prototype.disable = function () {
            this.removeControlPoints();
            this.worldWindow.removeLayer(this.controlPointLayer);

            this.removeAccessory();
            this.worldWindow.removeLayer(this.accessoryLayer);

            this.worldWindow.removeLayer(this.annotationLayer);

            this.worldWindow.removeLayer(this.shadowLayer);

            this.currentHeading = 0;
        };

        //Internal use only. Intentionally not documented.
        ShapeEditor.prototype.formatLatitude = function (number) {
            var suffix = number < 0 ? "\u00b0S" : "\u00b0N";
            return Math.abs(number).toFixed(4) + suffix;
        };

        //Internal use only. Intentionally not documented.
        ShapeEditor.prototype.formatLongitude = function (number) {
            var suffix = number < 0 ? "\u00b0W" : "\u00b0E";
            return Math.abs(number).toFixed(4) + suffix;
        };

        //Internal use only. Intentionally not documented.
        ShapeEditor.prototype.formatLength = function (number) {
            var suffix = " km";
            return Math.abs(number / 1000.0).toFixed(3) + suffix;
        };

        //Internal use only. Intentionally not documented.
        ShapeEditor.prototype.formatRotation = function (rotation) {
            return rotation.toFixed(4) + "°";
        };

        ShapeEditor.prototype.updateControlPoints = function () {
            if (this.shape && this.shape instanceof SurfaceShape) {

                if (this.shape instanceof SurfacePolygon ||
                    this.shape instanceof SurfacePolyline) {
                    this.updateSurfacePolygonControlPoints();
                }
                else if (this.shape instanceof SurfaceCircle) {
                    this.updateSurfaceCircleControlPoints();
                }
                else if (this.shape instanceof SurfaceRectangle) {
                    this.updateSurfaceRectangleControlPoints();
                }
                else if (this.shape instanceof SurfaceEllipse) {
                    this.updateSurfaceEllipseControlPoints();
                }
            }
        };

        /**
         * Set up the Path for the rotation line.
         */
        ShapeEditor.prototype.makeAccessory = function () {
            var pathPositions = [];
            pathPositions.push(new Position(0, 0, 0));
            pathPositions.push(new Position(0, 0, 0));
            var rotationLine = new Path(pathPositions, null);
            rotationLine.altitudeMode = WorldWind.CLAMP_TO_GROUND;
            rotationLine.followTerrain = true;

            var pathAttributes = new ShapeAttributes(null);
            pathAttributes.outlineColor = Color.GREEN;
            pathAttributes.outlineWidth = 2;
            rotationLine.attributes = pathAttributes;

            this.accessoryLayer.addRenderable(rotationLine);
        };

        /**
         * Remove the orientation line.
         */
        ShapeEditor.prototype.removeAccessory = function () {
            this.accessoryLayer.removeAllRenderables();
        };

        /**
         * Moves the entire shape according to a specified event.
         * @param {Event} event
         */
        ShapeEditor.prototype.dragWholeShape = function (event) {
            var refPos = this.shape.getReferencePosition();
            if (refPos === null) {
                return;
            }

            var refPoint = new Vec3(0, 0, 0);
            this.worldWindow.globe.computePointFromPosition(refPos.latitude, refPos.longitude, 0,
                refPoint);

            var screenRefPoint = new Vec3(0, 0, 0);
            this.worldWindow.drawContext.project(refPoint, screenRefPoint);

            // Compute screen-coord delta since last event.
            var dx = event.clientX - this.lastX;
            var dy = event.clientY - this.lastY;

            this.lastX = event.clientX;
            this.lastY = event.clientY;

            // Find intersection of screen coord ref-point with globe.
            var x = screenRefPoint[0] + dx;
            var y = this.worldWindow.canvas.height - screenRefPoint[1] + dy;

            var ray = this.worldWindow.rayThroughScreenPoint(new Vec2(x, y));

            var intersection = new Vec3(0, 0, 0);
            if (this.worldWindow.globe.intersectsLine(ray, intersection)) {
                var p = new Position(0, 0, 0);
                this.worldWindow.globe.computePositionFromPoint(intersection[0], intersection[1],
                    intersection[2], p);
                this.shape.moveTo(this.worldWindow.globe, new WorldWind.Location(p.latitude, p.longitude));
            }
        };

        /**
         * Modifies the shape's locations, size or rotation. This method is called when a control point is dragged.
         *
         * @param {PickedObject} terrainObject The terrain object.
         */
        ShapeEditor.prototype.reshapeShape = function (terrainObject) {
            if (!this.previousPosition) {
                this.previousPosition = terrainObject.position;
                return;
            }

            this.doReshapeShape(this.currentSizingMarker, terrainObject.position);

            this.previousPosition = terrainObject.position;
        };

        /**
         * Called by {@link ShapeEditor#reshapeShape} to perform the actual shape modification.
         * Subclasses should override this method if they provide editing for shapes other than those supported by
         * the basic editor.
         *
         * @param {Placemark} controlPoint The control point selected.
         * @param {Position} terrainPosition The terrain position under the cursor.
         */
        ShapeEditor.prototype.doReshapeShape = function (controlPoint, terrainPosition) {
            if (this.shape && this.shape instanceof SurfaceShape) {
                if (this.shape instanceof SurfacePolygon ||
                    this.shape instanceof SurfacePolyline
                ) {
                    this.reshapeSurfacePolygon(controlPoint, terrainPosition);
                }
                else if (this.shape instanceof SurfaceCircle) {
                    this.reshapeSurfaceCircle(controlPoint, terrainPosition);
                }
                else if (this.shape instanceof SurfaceRectangle) {
                    this.reshapeSurfaceRectangle(controlPoint, terrainPosition);
                }
                else if (this.shape instanceof SurfaceEllipse) {
                    this.reshapeSurfaceEllipse(controlPoint, terrainPosition);
                }
                this.currentSizingMarker.position = terrainPosition;
                this.worldWindow.redraw();
            }
        };

        /**
         * Computes the average location of a specified array of locations.
         * @param {Location[]} locations The array of locations for the shape.
         * @return {Position} the average of the locations specified in the array.
         */
        ShapeEditor.prototype.getCenter = function (locations) {
            var count = 0;
            var center = new Vec3(0, 0, 0);
            var globe = this.worldWindow.globe;

            if (locations.length > 0 && locations[0].length > 2) {
                for (var i = 0; i < locations.length; i++) {
                    for (var j = 0; j < locations[i].length; j++) {
                        center = center.add(globe.computePointFromPosition(
                            locations[i][j].latitude,
                            locations[i][j].longitude,
                            0,
                            new Vec3(0, 0, 0)));
                        ++count;
                    }
                }
            }
            else if (locations.length >= 2) {
                for (var i = 0; i < locations.length; i++) {
                    center = center.add(globe.computePointFromPosition(
                        locations[i].latitude,
                        locations[i].longitude,
                        0,
                        new Vec3(0, 0, 0)));
                    ++count;
                }
            }

            center = center.divide(count);

            return globe.computePositionFromPoint(
                center[0],
                center[1],
                center[2],
                new Position(0, 0, 0)
            );
        };

        /**
         *
         * @returns {Location} The shape's center location, or null if the shape has no designated center.
         */
        ShapeEditor.prototype.getShapeCenter = function () {
            var center = null;

            if (this.shape instanceof SurfaceEllipse || this.shape instanceof SurfaceRectangle) {
                center = this.shape.center;
            }

            return center;
        };

        /**
         * Computes the average distance between a specified center point and a list of locations.
         * @param {Globe} globe The globe to use for the computations.
         * @param {Location} center The center point.
         * @param {Array} locations The locations.
         * @returns {Number} The average distance.
         */
        ShapeEditor.prototype.getAverageDistance = function (globe, center, locations) {
            var count = locations.length;

            var centerPoint = globe.computePointFromLocation(
                center.latitude,
                center.longitude,
                new Vec3(0, 0, 0)
            );

            var totalDistance = 0;
            for (var i = 0; i < locations.length; i++) {
                var distance = globe.computePointFromLocation(
                    locations[i].latitude,
                    locations[i].longitude,
                    new Vec3(0, 0, 0)).distanceTo(centerPoint);
                totalDistance += distance / count;
            }

            return (count === 0) ? 0 : totalDistance / globe.equatorialRadius;
        };

        /**
         * Updates the annotation associated with a specified control point.
         * @param {Placemark} controlPoint The control point.
         */
        ShapeEditor.prototype.updateAnnotation = function (controlPoint) {
            if (!controlPoint) {
                this.annotationLayer.enabled = false;
                return;
            }

            this.annotationLayer.enabled = true;
            this.annotation.position = new Position(
                controlPoint.position.latitude,
                controlPoint.position.longitude,
                0
            );

            var annotationText;
            if (controlPoint.userProperties.size !== undefined) {
                annotationText = this.formatLength(controlPoint.userProperties.size);
            }
            else if (controlPoint.userProperties.rotation !== undefined) {
                annotationText = this.formatRotation(controlPoint.userProperties.rotation);
            }
            else {
                annotationText = this.formatLatitude(controlPoint.position.latitude) + " " +
                    this.formatLongitude(controlPoint.position.longitude);
            }

            this.annotation.text = annotationText;
        };

        /**
         * Updates the line designating the shape's central axis.
         * @param {Position} centerPosition The shape's center location and altitude at which to place one of the line's
         * end points.
         * @param {Position} controlPointPosition  The shape orientation control point's position.
         */
        ShapeEditor.prototype.updateOrientationLine = function (centerPosition, controlPointPosition) {
            if (this.accessoryLayer.renderables.length == 0) {
                return;
            }

            var positions = [];
            positions.push(centerPosition, controlPointPosition);
            var rotationLine = this.accessoryLayer.renderables[0];
            rotationLine.positions = positions;
        };

        /**
         * Computes the Cartesian difference between two control points.
         * @param {Position} previousPosition The position of the previous control point.
         * @param {Position} currentPosition  The position of the current control point.
         * @returns {Vec3} The Cartesian difference between the two control points.
         */
        ShapeEditor.prototype.computeControlPointDelta = function (previousPosition, currentPosition) {
            var terrainPoint = this.worldWindow.globe.computePointFromPosition(
                currentPosition.latitude,
                currentPosition.longitude,
                currentPosition.altitude,
                new Vec3(0, 0, 0)
            );
            var previousPoint = this.worldWindow.globe.computePointFromPosition(
                previousPosition.latitude,
                previousPosition.longitude,
                previousPosition.altitude,
                new Vec3(0, 0, 0)
            );

            return terrainPoint.subtract(previousPoint);
        };

        /**
         * Add a specified increment to an angle and normalize the result to be between 0 and 360 degrees.
         * @param {Number} originalHeading The base angle.
         * @param {Number} deltaHeading The increment to add prior to normalizing.
         * @returns {Number} The normalized angle.
         */
        ShapeEditor.prototype.normalizedHeading = function (originalHeading, deltaHeading) {
            var newHeading = originalHeading * Angle.DEGREES_TO_RADIANS + deltaHeading * Angle.DEGREES_TO_RADIANS;

            if (Math.abs(newHeading) > Angle.TWO_PI) {
                newHeading = newHeading % Angle.TWO_PI;
            }

            return Angle.RADIANS_TO_DEGREES * (newHeading >= 0 ? newHeading : newHeading + Angle.TWO_PI);
        };

        /**
         * Computes the point on a specified line segment that is nearest a specified point.
         *
         * @param {Vec3} p1 The line's first point.
         * @param {Vec3} p2 The line's second point.
         * @param {Vec3} point The point for which to determine a nearest point on the line segment.
         * @returns {Vec3} The nearest point on the line segment.
         */
        ShapeEditor.prototype.nearestPointOnSegment = function (p1, p2, point) {
            var segment = p2.subtract(p1);

            var segmentCopy = new Vec3(0, 0, 0);
            segmentCopy.copy(segment);
            var dir = segmentCopy.normalize();

            var dot = point.subtract(p1).dot(dir);
            if (dot < 0.0) {
                return p1;
            }
            else if (dot > segment.magnitude()) {
                return p2;
            }
            else {
                return Vec3.fromLine(p1, dot, dir);
            }
        };

        /**
         * Inserts the location nearest to a specified position on an edge of a specified list of locations into the
         * appropriate place in that list.
         * @param {Position} terrainPosition The position to find a nearest point for.
         * @param {Number} altitude The altitude to use when determining the nearest point. Can be approximate and is
         * not necessarily the altitude of the terrain position.
         * @param {Location[]} locations The list of locations. This list is modified by this method to contain the new
         * location on an edge nearest the specified terrain position.
         */
        ShapeEditor.prototype.addNearestLocation = function (terrainPosition, altitude, locations) {
            var globe = this.worldWindow.globe;

            // Find the nearest edge to the picked point and insert a new position on that edge.
            var pointPicked = globe.computePointFromPosition(
                terrainPosition.latitude,
                terrainPosition.longitude,
                altitude,
                new Vec3(0, 0, 0)
            );

            var nearestPoint = null;
            var nearestSegmentIndex = 0;
            var nearestDistance = Number.MAX_VALUE;
            for (var i = 1; i <= locations.length; i++) // <= is intentional, to handle the closing segment
            {
                // Skip the closing segment if the shape is not a polygon.
                if (!(this.shape instanceof SurfacePolygon ) && i == locations.length) {
                    continue;
                }

                var locationA = locations[i - 1];
                var locationB = locations[i == locations.length ? 0 : i];

                var pointA = globe.computePointFromPosition(
                    locationA.latitude,
                    locationA.longitude,
                    altitude,
                    new Vec3(0, 0, 0)
                );

                var pointB = this.worldWindow.globe.computePointFromPosition(
                    locationB.latitude,
                    locationB.longitude,
                    altitude,
                    new Vec3(0, 0, 0)
                );

                var pointOnEdge = this.nearestPointOnSegment(pointA, pointB, new Vec3(pointPicked[0], pointPicked[1], pointPicked[2]));

                var distance = pointOnEdge.distanceTo(pointPicked);
                if (distance < nearestDistance) {
                    nearestPoint = pointOnEdge;
                    nearestSegmentIndex = i;
                    nearestDistance = distance;
                }
            }

            if (nearestPoint) {
                // Compute the location of the nearest point and add it to the shape.
                var nearestLocation = this.worldWindow.globe.computePositionFromPoint(
                    nearestPoint[0],
                    nearestPoint[1],
                    nearestPoint[2],
                    new Position(0, 0, 0)
                );

                if (nearestSegmentIndex == locations.length)
                    locations.push(nearestLocation);
                else
                    locations.splice(nearestSegmentIndex, 0, nearestLocation);

                this.removeControlPoints();
                this.shape.boundaries = locations;
                this.updateControlPoints();
            }
        };

        /**
         * Moves a control point location.
         * @param {Placemark} controlPoint The control point being moved.
         * @param {Position} terrainPosition The position selected by the user.
         * @returns {Position} The position after move.
         */
        ShapeEditor.prototype.moveLocation = function (controlPoint, terrainPosition) {
            var delta = this.computeControlPointDelta(this.previousPosition, terrainPosition);
            var markerPoint = this.worldWindow.globe.computePointFromPosition(
                controlPoint.position.latitude,
                controlPoint.position.longitude,
                0,
                new Vec3(0, 0, 0)
            );

            markerPoint.add(delta);
            var markerPosition = this.worldWindow.globe.computePositionFromPoint(
                markerPoint[0],
                markerPoint[1],
                markerPoint[2],
                new Position(0, 0, 0)
            );

            return markerPosition;
        };

        /**
         * Rotates a shape's locations.
         * @param {Position} terrainPosition The position selected by the user.
         * @param {Location[]} locations The array of locations for the shape.
         */
        ShapeEditor.prototype.rotateLocations = function (terrainPosition, locations) {
            var center = this.getCenter(locations);
            var previousHeading = Location.greatCircleAzimuth(center, this.previousPosition);
            var deltaHeading = Location.greatCircleAzimuth(center, terrainPosition) - previousHeading;
            this.currentHeading = this.normalizedHeading(this.currentHeading, deltaHeading);

            if (locations.length > 0 && locations[0].length > 2) {
                for (var i = 0; i < locations.length; i++) {
                    for (var j = 0; j < locations[i].length; j++) {
                        var heading = Location.greatCircleAzimuth(center, locations[i][j]);
                        var distance = Location.greatCircleDistance(center, locations[i][j]);
                        var newLocation = Location.greatCircleLocation(center, heading + deltaHeading, distance,
                            new Location(0, 0));
                        locations[i][j] = newLocation;
                    }
                }
            }
            else if (locations.length >= 2) {
                for (var i = 0; i < locations.length; i++) {
                    var heading = Location.greatCircleAzimuth(center, locations[i]);
                    var distance = Location.greatCircleDistance(center, locations[i]);
                    var newLocation = Location.greatCircleLocation(center, heading + deltaHeading, distance,
                        new Location(0, 0));
                    locations[i] = newLocation;
                }
            }
        };

        ShapeEditor.prototype.setPreviousPosition = function (event) {
            var mousePoint = this.worldWindow.canvasCoordinates(event.clientX,
                event.clientY);
            if (this.worldWindow.viewport.containsPoint(mousePoint)) {
                var terrainObject = this.worldWindow.pickTerrain(mousePoint).terrainObject();
                if (terrainObject) {
                    this.previousPosition = new Position(
                        terrainObject.position.latitude,
                        terrainObject.position.longitude,
                        terrainObject.position.altitude
                    );
                }
            }
        };

        //Internal use only. Intentionally not documented.
        ShapeEditor.prototype.reshapeSurfacePolygon = function (controlPoint, terrainPosition) {
            var boundaries = this.shape.boundaries;
            var locations = [];

            var k = 0;
            var newPos;

            if (boundaries.length > 0 && boundaries[0].length > 2) {
                outer:
                    for (var i = 0; i < boundaries.length; i++) {
                        for (var j = 0; j < boundaries[i].length; j++) {
                            if (controlPoint.userProperties.purpose == ShapeEditor.LOCATION) {
                                if (controlPoint.userProperties.id == k) {
                                    newPos = this.moveLocation(controlPoint, terrainPosition);
                                    boundaries[i][j] = newPos;
                                    this.shape.boundaries = boundaries;
                                    controlPoint.position = newPos;
                                    break outer;
                                }
                            }
                            else if (controlPoint.userProperties.purpose == ShapeEditor.ROTATION) {
                                this.rotateLocations(terrainPosition, boundaries);
                                this.shape.boundaries = boundaries;
                                break outer;
                            }
                            k++;
                        }
                    }
            }
            else if (boundaries.length >= 2) {
                //poly without whole
                for (var i = 0; i < boundaries.length; i++) {
                    if (controlPoint.userProperties.purpose == ShapeEditor.LOCATION) {
                        if (controlPoint.userProperties.id == k) {
                            if (this.currentEvent.altKey) {
                                //remove location
                                var minSize = this.shape instanceof SurfacePolygon ? 3 : 2;
                                if (boundaries.length > minSize) {
                                    // Delete the control point.
                                    boundaries.splice(i, 1);
                                    this.shape.boundaries = boundaries;
                                    this.removeControlPoints();
                                }
                            }
                            else {
                                newPos = this.moveLocation(controlPoint, terrainPosition);
                                boundaries[i] = newPos;
                                this.shape.boundaries = boundaries;
                                controlPoint.position = newPos;
                            }
                            break;
                        }
                    } else if (controlPoint.userProperties.purpose == ShapeEditor.ROTATION) {
                        this.rotateLocations(terrainPosition, boundaries);
                        this.shape.boundaries = boundaries;
                        break;
                    }
                    k++;
                }
            }

            this.updateAnnotation(controlPoint);
        };

        //Internal use only. Intentionally not documented.
        ShapeEditor.prototype.updateSurfacePolygonControlPoints = function () {
            var locations = [];

            if (this.shape.boundaries.length > 0 && this.shape.boundaries[0].length > 2) {
                for (var i = 0; i < this.shape.boundaries.length; i++) {
                    for (var j = 0; j < this.shape.boundaries[i].length; j++) {
                        locations.push(this.shape.boundaries[i][j]);
                    }
                }
            }
            else if (this.shape.boundaries.length >= 2) {
                for (var i = 0; i < this.shape.boundaries.length; i++) {
                    locations.push(this.shape.boundaries[i]);
                }
            }

            if (locations.length < 2)
                return;

            var globe = this.worldWindow.globe;
            var polygonCenter = this.getCenter(locations);
            var shapeRadius = this.getAverageDistance(globe, polygonCenter, locations);
            shapeRadius = shapeRadius * 1.2;
            var heading = this.currentHeading;
            var rotationControlLocation = Location.greatCircleLocation(
                polygonCenter,
                heading,
                shapeRadius,
                new Location(0, 0));

            var rotationPosition = new Position(
                rotationControlLocation.latitude,
                rotationControlLocation.longitude,
                0);

            var markers = this.controlPointLayer.renderables;

            if (markers.length > 0) {
                for (var i = 0; i < locations.length; i++) {
                    markers[i].position = locations[i];
                }
                markers[locations.length].position = rotationPosition;
                markers[locations.length].userProperties.rotation = heading;
            }
            else {
                var controlPointMarker;
                for (var i = 0; i < locations.length; i++) {
                    controlPointMarker = new Placemark(
                        locations[i],
                        false,
                        this.locationControlPointAttributes);
                    controlPointMarker.userProperties.isControlPoint = true;
                    controlPointMarker.userProperties.id = i;
                    controlPointMarker.userProperties.purpose = ShapeEditor.LOCATION;

                    controlPointMarker.altitudeMode = WorldWind.CLAMP_TO_GROUND;
                    this.controlPointLayer.addRenderable(controlPointMarker);
                }

                controlPointMarker = new Placemark(
                    rotationPosition,
                    false,
                    this.angleControlPointAttributes
                );

                controlPointMarker.userProperties.isControlPoint = true;
                controlPointMarker.userProperties.id = locations.length;
                controlPointMarker.userProperties.purpose = ShapeEditor.ROTATION;
                controlPointMarker.userProperties.rotation = heading;

                controlPointMarker.altitudeMode = WorldWind.CLAMP_TO_GROUND;

                this.controlPointLayer.addRenderable(controlPointMarker);
            }

            this.updateOrientationLine(polygonCenter, rotationPosition);
        };

        //Internal use only. Intentionally not documented.
        ShapeEditor.prototype.reshapeSurfaceCircle = function (controlPoint, terrainPosition) {
            if (!controlPoint) {
                return;
            }

            var circle = this.shape;

            var delta = this.computeControlPointDelta(this.previousPosition, terrainPosition);
            var centerPoint = this.worldWindow.globe.computePointFromPosition(
                circle.center.latitude,
                circle.center.longitude,
                0,
                new Vec3(0, 0, 0)
            );
            var markerPoint = this.worldWindow.globe.computePointFromPosition(
                controlPoint.position.latitude,
                controlPoint.position.longitude,
                0,
                new Vec3(0, 0, 0)
            );

            var vMarker = markerPoint.subtract(centerPoint).normalize();

            var radius = circle.radius + delta.dot(vMarker);
            if (radius > 0) {
                circle.radius = radius;
            }

            this.updateAnnotation(controlPoint);
        };

        //Internal use only. Intentionally not documented.
        ShapeEditor.prototype.updateSurfaceCircleControlPoints = function () {
            var circle = this.shape;

            var radiusLocation = Location.greatCircleLocation(
                circle.center,
                90,
                circle.radius / this.worldWindow.globe.equatorialRadius,
                new Location(0, 0));

            var markers = this.controlPointLayer.renderables;

            if (markers.length > 0) {
                markers[0].position = radiusLocation;
            }
            else {
                var controlPointMarker = new Placemark(
                    radiusLocation,
                    false,
                    this.sizeControlPointAttributes
                );
                controlPointMarker.userProperties.isControlPoint = true;
                controlPointMarker.userProperties.id = 0;
                controlPointMarker.userProperties.purpose = ShapeEditor.OUTER_RADIUS;

                controlPointMarker.altitudeMode = WorldWind.CLAMP_TO_GROUND;
                this.controlPointLayer.addRenderable(controlPointMarker);
            }

            markers[0].userProperties.size = circle.radius;
        };

        //Internal use only. Intentionally not documented.
        ShapeEditor.prototype.reshapeSurfaceRectangle = function (controlPoint, terrainPosition) {
            if (!controlPoint) {
                return;
            }

            var rectangle = this.shape;

            var terrainPoint = this.worldWindow.globe.computePointFromPosition(
                terrainPosition.latitude,
                terrainPosition.longitude,
                0,
                new Vec3(0, 0, 0)
            );
            var previousPoint = this.worldWindow.globe.computePointFromPosition(
                this.previousPosition.latitude,
                this.previousPosition.longitude,
                0,
                new Vec3(0, 0, 0)
            );
            var delta = terrainPoint.subtract(previousPoint);

            var centerPoint = this.worldWindow.globe.computePointFromPosition(
                this.shape.center.latitude,
                this.shape.center.longitude,
                0,
                new Vec3(0, 0, 0)
            );
            var markerPoint = this.worldWindow.globe.computePointFromPosition(
                controlPoint.position.latitude,
                controlPoint.position.longitude,
                0,
                new Vec3(0, 0, 0)
            );
            var vMarker = markerPoint.subtract(centerPoint).normalize();

            if (controlPoint.userProperties.purpose == ShapeEditor.WIDTH || controlPoint.userProperties.purpose == ShapeEditor.HEIGHT) {
                var width = rectangle.width + (controlPoint.userProperties.id == 0 ? delta.dot(vMarker) * 2 : 0);
                var height = rectangle.height + (controlPoint.userProperties.id == 1 ? delta.dot(vMarker) * 2 : 0);

                if (width > 0 && height > 0) {
                    rectangle.width = width;
                    rectangle.height = height;
                }
            }
            else {
                var oldHeading = Location.greatCircleAzimuth(rectangle.center, this.previousPosition);
                var deltaHeading = Location.greatCircleAzimuth(rectangle.center, terrainPosition) - oldHeading;
                rectangle.heading = this.normalizedHeading(rectangle.heading, deltaHeading);
            }

            this.updateAnnotation(controlPoint);
        };

        //Internal use only. Intentionally not documented.
        ShapeEditor.prototype.updateSurfaceRectangleControlPoints = function () {
            var rectangle = this.shape;

            var widthLocation = Location.greatCircleLocation(
                rectangle.center,
                90 + rectangle.heading,
                0.5 * rectangle.width / this.worldWindow.globe.equatorialRadius,
                new Location(0, 0));

            var heightLocation = Location.greatCircleLocation(
                rectangle.center,
                rectangle.heading,
                0.5 * rectangle.height / this.worldWindow.globe.equatorialRadius,
                new Location(0, 0));

            var rotationLocation = Location.greatCircleLocation(
                rectangle.center,
                rectangle.heading,
                0.7 * rectangle.height / this.worldWindow.globe.equatorialRadius,
                new Location(0, 0));

            var markers;

            markers = this.controlPointLayer.renderables;

            if (markers.length > 0) {
                markers[0].position = widthLocation;
                markers[1].position = heightLocation;
                markers[2].position = rotationLocation;
            }
            else {
                var controlPointMarker = new Placemark(
                    widthLocation,
                    false,
                    this.sizeControlPointAttributes
                );
                controlPointMarker.userProperties.isControlPoint = true;
                controlPointMarker.userProperties.id = 0;
                controlPointMarker.userProperties.purpose = ShapeEditor.WIDTH;

                controlPointMarker.altitudeMode = WorldWind.CLAMP_TO_GROUND;
                this.controlPointLayer.addRenderable(controlPointMarker);

                controlPointMarker = new Placemark(
                    heightLocation,
                    false,
                    this.sizeControlPointAttributes
                );
                controlPointMarker.userProperties.isControlPoint = true;
                controlPointMarker.userProperties.id = 1;
                controlPointMarker.userProperties.purpose = ShapeEditor.HEIGHT;

                controlPointMarker.altitudeMode = WorldWind.CLAMP_TO_GROUND;
                this.controlPointLayer.addRenderable(controlPointMarker);

                controlPointMarker = new Placemark(
                    rotationLocation,
                    false,
                    this.angleControlPointAttributes
                );
                controlPointMarker.userProperties.isControlPoint = true;
                controlPointMarker.userProperties.id = 1;
                controlPointMarker.userProperties.purpose = ShapeEditor.ROTATION;

                controlPointMarker.altitudeMode = WorldWind.CLAMP_TO_GROUND;
                this.controlPointLayer.addRenderable(controlPointMarker);
            }

            markers[0].userProperties.size = rectangle.width;
            markers[1].userProperties.size = rectangle.height;
            markers[2].userProperties.rotation = rectangle.heading;

            this.updateOrientationLine(rectangle.center, rotationLocation);
        };

        //Internal use only. Intentionally not documented.
        ShapeEditor.prototype.reshapeSurfaceEllipse = function (controlPoint, terrainPosition) {
            if (!controlPoint) {
                return;
            }

            var ellipse = this.shape;

            var terrainPoint = this.worldWindow.globe.computePointFromPosition(
                terrainPosition.latitude,
                terrainPosition.longitude,
                0,
                new Vec3(0, 0, 0)
            );
            var previousPoint = this.worldWindow.globe.computePointFromPosition(
                this.previousPosition.latitude,
                this.previousPosition.longitude,
                0,
                new Vec3(0, 0, 0)
            );
            var delta = terrainPoint.subtract(previousPoint);

            var centerPoint = this.worldWindow.globe.computePointFromPosition(
                ellipse.center.latitude,
                ellipse.center.longitude,
                0,
                new Vec3(0, 0, 0)
            );
            var markerPoint = this.worldWindow.globe.computePointFromPosition(
                controlPoint.position.latitude,
                controlPoint.position.longitude,
                0,
                new Vec3(0, 0, 0)
            );
            var vMarker = markerPoint.subtract(centerPoint).normalize();

            if (controlPoint.userProperties.purpose == ShapeEditor.WIDTH ||
                controlPoint.userProperties.purpose == ShapeEditor.HEIGHT) {
                var majorRadius = ellipse.majorRadius + (controlPoint.userProperties.id == 0 ? delta.dot(vMarker) : 0);
                var minorRadius = ellipse.minorRadius + (controlPoint.userProperties.id == 1 ? delta.dot(vMarker) : 0);

                if (majorRadius > 0 && minorRadius > 0) {
                    ellipse.majorRadius = majorRadius;
                    ellipse.minorRadius = minorRadius;
                }
            } else {
                var oldHeading = Location.greatCircleAzimuth(ellipse.center, this.previousPosition);
                var deltaHeading = Location.greatCircleAzimuth(ellipse.center, terrainPosition) - oldHeading;
                ellipse.heading = this.normalizedHeading(ellipse.heading, deltaHeading);
            }

            this.updateAnnotation(controlPoint);
        };

        //Internal use only. Intentionally not documented.
        ShapeEditor.prototype.updateSurfaceEllipseControlPoints = function () {
            var ellipse = this.shape;

            var majorLocation = Location.greatCircleLocation(
                ellipse.center,
                90 + ellipse.heading,
                ellipse.majorRadius / this.worldWindow.globe.equatorialRadius,
                new Location(0, 0));

            var minorLocation = Location.greatCircleLocation(
                ellipse.center,
                ellipse.heading,
                ellipse.minorRadius / this.worldWindow.globe.equatorialRadius,
                new Location(0, 0));

            var rotationLocation = Location.greatCircleLocation(
                ellipse.center,
                ellipse.heading,
                1.15 * ellipse.minorRadius / this.worldWindow.globe.equatorialRadius,
                new Location(0, 0)
            );

            var markers = this.controlPointLayer.renderables;

            if (markers.length > 0) {
                markers[0].position = majorLocation;
                markers[1].position = minorLocation;
                markers[2].position = rotationLocation;
            }
            else {
                var controlPointMarker = new Placemark(
                    majorLocation,
                    false,
                    this.sizeControlPointAttributes
                );
                controlPointMarker.userProperties.isControlPoint = true;
                controlPointMarker.userProperties.id = 0;
                controlPointMarker.userProperties.purpose = ShapeEditor.WIDTH;

                controlPointMarker.altitudeMode = WorldWind.CLAMP_TO_GROUND;
                this.controlPointLayer.addRenderable(controlPointMarker);

                controlPointMarker = new Placemark(
                    minorLocation,
                    false,
                    this.sizeControlPointAttributes
                );
                controlPointMarker.userProperties.isControlPoint = true;
                controlPointMarker.userProperties.id = 1;
                controlPointMarker.userProperties.purpose = ShapeEditor.HEIGHT;

                controlPointMarker.altitudeMode = WorldWind.CLAMP_TO_GROUND;
                this.controlPointLayer.addRenderable(controlPointMarker);

                controlPointMarker = new Placemark(
                    rotationLocation,
                    false,
                    this.angleControlPointAttributes
                );
                controlPointMarker.userProperties.isControlPoint = true;
                controlPointMarker.userProperties.id = 2;
                controlPointMarker.userProperties.purpose = ShapeEditor.ROTATION;

                controlPointMarker.altitudeMode = WorldWind.CLAMP_TO_GROUND;
                this.controlPointLayer.addRenderable(controlPointMarker);
            }

            markers[0].userProperties.size = ellipse.majorRadius;
            markers[1].userProperties.size = ellipse.minorRadius;
            markers[2].userProperties.rotation = ellipse.heading;

            this.updateOrientationLine(ellipse.center, rotationLocation);
        };

        // Indicates that a control point is associated with annotation.
        ShapeEditor.ANNOTATION = "annotation";

        // Indicates a control point is associated with a location.
        ShapeEditor.LOCATION = "location";

        // Indicates that a control point is associated with whole-shape rotation.
        ShapeEditor.ROTATION = "rotation";

        // Indicates that a control point is associated with width change.
        ShapeEditor.WIDTH = "width";

        // Indicates that a control point is associated with height change.
        ShapeEditor.HEIGHT = "height";

        // Indicates that a control point is associated with the right width of a shape.
        ShapeEditor.RIGHT_WIDTH = "rightWidth";

        // Indicates that a control point is associated with the outer radius of a shape.
        ShapeEditor.OUTER_RADIUS = "outerRadius";

        return ShapeEditor;
    }
);