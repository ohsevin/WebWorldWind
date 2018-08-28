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
 * @exports WfsDelete
 */
define([],
    function () {
        "use strict";

        /**
         * Creates nodes representing the delete operation inside of the Transaction.
         * @constructor
         * @alias WfsDelete
         */
        var WfsDelete = function(document) {
            this._xmlDocument = document;
        };

        /**
         * Creates Dom XML Node representation of the WFS Delete element.
         * TODO: Make sure the delete operation is valid.
         * @param typeName {String}
         * @param propertyName {String}
         * @return {Node}
         */
        WfsDelete.prototype.dom = function(typeName, propertyName) {
            var element = this._xmlDocument.createElement('wfs:Delete');
            element.setAttribute('typeName', typeName);

            var filter = this._xmlDocument.createElement('ogc:Filter');
            var filterType = this._xmlDocument.createElement('ogc:PropertyIsEqualTo');
            var propName = this._xmlDocument.createElement('ogc:PropertyName');
            propName.textContent = propertyName;

            // This probably needs to be removed.
            var literal = this._xmlDocument.createElement('ogc:Literal');
            literal.textContent = 'alley';
            filterType.appendChild(propName);
            filterType.appendChild(literal);
            filter.appendChild(filterType);
            element.appendChild(filter);

            return this._xmlDocument;
        };

        return WfsDelete;
    });
