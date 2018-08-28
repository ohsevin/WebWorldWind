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
 * @exports UpdateXmlBuilder
 */
define([], function () {
    "use strict";

    /**
     *
     * @constructor
     */
    var WfsUpdate = function(document) {
        this._xmlDocument = document;
    };

    WfsUpdate.prototype.dom = function(typeName, propertyName, value, filterId) {
        var update = this._xmlDocument.createElement('wfs:Update');
        update.setAttribute('typeName', typeName);
        var prop = this._xmlDocument.createElement('wfs:Property');
        var propName = this._xmlDocument.createElement('wfs:Name');
        propName.textContent = propertyName;
        var literal = this._xmlDocument.createElement('wfs:Value');
        literal.textContent = value;
        prop.appendChild(propName);
        prop.appendChild(literal);
        update.appendChild(prop);
        update.appendChild(this.filter(filterId));

        return update;
    };

    // Update geometry. Different types of the geometry.
    WfsUpdate.prototype.updateGeom = function(typeName, propertyName, value, filterId) {
        var update = this._xmlDocument.createElement('wfs:Update');
        update.setAttribute('typeName', typeName);
        var prop = this._xmlDocument.createElement('wfs:Property');
        var propName = this._xmlDocument.createElement('wfs:Name');
        propName.textContent = propertyName;
        var literal = this._xmlDocument.createElement('wfs:Value');
        literal.appendChild(this.geometry(value));
        prop.appendChild(propName);
        prop.appendChild(literal);
        update.appendChild(prop);
        update.appendChild(this.filter(filterId));

        return update;
    };

    WfsUpdate.prototype.geometry = function (coordinate) {
        var multiLine = this._xmlDocument.createElement('gml:MultiLineString');
        multiLine.setAttribute('srsName', "http://www.opengis.net/gml/srs/epsg.xml#4326");
        var lineStringMember = this._xmlDocument.createElement('gml:lineStringMember');
        var lineString = this._xmlDocument.createElement('gml:LineString');
        var coordinates = this._xmlDocument.createElement('gml:coordinates');
        coordinates.textContent = coordinate;
        lineString.appendChild(coordinates);
        lineStringMember.appendChild(lineString);
        multiLine.appendChild(lineStringMember);

        return multiLine;
    };

    WfsUpdate.prototype.filter = function(filterId) {
        var filter = this._xmlDocument.createElement('ogc:Filter');
        var id = this._xmlDocument.createElement('ogc:FeatureId');
        id.setAttribute('fid', filterId);
        filter.appendChild(id);

        return filter;
    };

    return WfsUpdate;
});
