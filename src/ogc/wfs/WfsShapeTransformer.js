define([], function () {
        "use strict";
        /**
         * Accepts AbstractShape from the Shapes and transforms in the coordinates with the type that can be used by the
         * XML Builders.
         */
        var WfsShapeTransformer = function () {
        };

        /**
         * Transform the internal Shape into the representation, which is correctly interpreted by the WFS service.
         * @param shape
         */
        WfsShapeTransformer.prototype.transform = function (shape) {
            var shapeVal = {};
            if (shape.boundaries) {
                shapeVal.type = 'Polygon';
                shapeVal.coordinates = shape.boundaries;
            }
            if (shape.positions) {
                shapeVal.type = 'MultiLineString';
                shapeVal.coordinates = shape.positions;
            }

            return shapeVal;
        };

        return WfsShapeTransformer;

    });