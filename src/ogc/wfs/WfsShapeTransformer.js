/*
 * Copyright 2003-2006, 2009, 2017, United States Government, as represented by the Administrator of the
 * National Aeronautics and Space Administration. All rights reserved.
 *
 * The NASAWorldWind/WebWorldWind platform is licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
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
            } else if (shape.positions) {
                shapeVal.type = 'MultiLineString';
                shapeVal.coordinates = shape.positions;
            }

            return shapeVal;
        };

        return WfsShapeTransformer;

    });