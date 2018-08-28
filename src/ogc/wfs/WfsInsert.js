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
/**
 * @exports InsertXmlBuilder
 */
define(['src/ogc/wfs/ShapeTransformer'],
    function (ShapeTransformer) {
        "use strict";

        /**
         * Factory creating the Insert nodes for the Transaction and potentially other use cases.
         * @constructor
         * @alias WfsInsert
         * @param document {XmlDocument}
         */
        var WfsInsert = function (document) {
            this._xmlDocument = document;

            this._shapeTransformer = new ShapeTransformer();
        };

        /**
         * Creates dom representation of the Insert node.
         * @param shape {Shape} Shape to be transformed for the usage in the GML
         * @param typeName {String} Name of the type to be used.
         * @return {Node} Node representing the relevant Insert
         */
        WfsInsert.prototype.dom = function (shape, typeName) {
            var insert = this._xmlDocument.createElement('wfs:Insert');
            var typename = this._xmlDocument.createElement(typeName);
            var geom = this._xmlDocument.createElement('topp:the_geom');

            var transformedGeometry = this._shapeTransformer.transform(shape);
            geom.appendChild(
                this.geometry(this._xmlDocument, transformedGeometry.type, transformedGeometry.coordinates)
            );

            var type = this._xmlDocument.createElement('topp:TYPE');
            type.textContent = 'alley';
            typename.appendChild(geom);
            typename.appendChild(type);
            insert.appendChild(typename);

            return insert;
        };

        /**
         *
         * @private
         * @param type {String} Type is currently supported only for MultiLineString and Polygon
         * @param coordinate {String} coordinates.
         * @return {Node} geometry node relevant for the Insert
         */
        WfsInsert.prototype.geometry = function (type, coordinate) {
            var geometry;

            if (type === 'MultiLineString') {
                geometry = this._xmlDocument.createElement('gml:MultiLineString');
                geometry.setAttribute('srsName', "http://www.opengis.net/gml/srs/epsg.xml#4326");
                var lineStringMember = this._xmlDocument.createElement('gml:lineStringMember');
                var lineString = this._xmlDocument.createElement('gml:LineString');
                var coordinates = this._xmlDocument.createElement('gml:coordinates');
                coordinates.setAttribute('decimal', ".");
                coordinates.setAttribute('cs', ",");
                coordinates.setAttribute('ts', " ");
                coordinates.textContent = coordinate;
                lineString.appendChild(coordinates);
                lineStringMember.appendChild(lineString);
                geometry.appendChild(lineStringMember);
            } else if (type === 'Polygon') {
                geometry = this._xmlDocument.createElement('gml:Polygon');
                geometry.setAttribute('srsName', "urn:ogc:def:crs:EPSG::4326http://www.opengis.net/def/crs/epsg/0/4326");
                geometry.setAttribute('gml:id', "P1");
                var exter = this._xmlDocument.createElement('gml:exterior');
                var linearRing = this._xmlDocument.createElement('gml:LinearRing');
                var posList = this._xmlDocument.createElement('gml:posList');
                posList.textContent = coordinate;

                linearRing.appendChild(posList);
                exter.appendChild(linearRing);
                geometry.appendChild(exter);
            }

            return geometry
        };

        return WfsInsert;
    });


