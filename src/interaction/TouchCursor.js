/*	Copyright (c) 2016 Jean-Marc VIGLINO, 
  released under the CeCILL-B license (French BSD license)
  (http://www.cecill.info/licences/Licence_CeCILL-B_V1-en.txt).
*/

import ol_ext_inherits from '../util/ext'
import ol_interaction_DragOverlay from './DragOverlay'
import {unByKey as ol_Observable_unByKey} from 'ol/Observable'
import ol_interaction_Interaction from 'ol/interaction/Interaction'
import ol_Overlay from 'ol/Overlay'
import ol_ext_element from '../util/element'

/** Handle a touch cursor to defer event position on overlay position
 * It can be used as abstract base class used for creating subclasses. 
 * The TouchCursor interaction modifies map browser event coordinate and pixel properties to force pointer on the graphic cursor on the screen to any interaction that them.
 * @constructor
 * @extends {ol_interaction_DragOverlay}
 * @param {olx.interaction.InteractionOptions} options Options
 *  @param {string} options.className cursor class name
 *  @param {ol.coordinate} options.coordinate position of the cursor
 *  @param {Array<*>} options.buttons an array of buttons
 */
var ol_interaction_TouchCursor = function(options) {
  options = options || {};

  // List of listerner on the object
  this._listeners = {};

  // Interaction to defer position on top of the interaction 
  // this is done to enable other coordinates manipulation inserted after the interaction (snapping)
  var offset = [-33,-33];
  this.ctouch = new ol_interaction_Interaction({
    handleEvent: function(e) {
      if (!/drag/.test(e.type) && this.getMap()) {
        e.coordinate = this.overlay.getPosition();
        e.pixel = this.getMap().getPixelFromCoordinate(e.coordinate);
      } else {
        var res = e.frameState.viewState.resolution
        var cosa = Math.cos(e.frameState.viewState.rotation);
        var sina = Math.sin(e.frameState.viewState.rotation);
        e.coordinate = [
          e.coordinate[0] + cosa*offset[0]*res + sina*offset[1]*res, 
          e.coordinate[1] + sina*offset[0]*res - cosa*offset[1]*res
        ];
        e.pixel = this.getMap().getPixelFromCoordinate(e.coordinate);
      }
      this._lastEvent = e;
      return true; 
    }.bind(this)
  });
  // Force interaction on top
  this.ctouch.set('onTop', true);

  // Add Overlay
  this.overlay = new ol_Overlay({
    className: ('ol-touch-cursor '+(options.className||'')).trim(),
    positioning: 'top-left',
    element: ol_ext_element.create('DIV', {}),
    stopEvent: false,
  });
  this.setPosition(options.coordinate);
  if (options.buttons) {
    var elt = this.overlay.element;
    var begin = options.buttons.length > 4 ? 0 : 1;
    options.buttons.forEach((function (b, i) {
      if (i<5) {
        ol_ext_element.create('DIV', {
          className: ((b.className||'')+' ol-button ol-button-' + (i+begin)).trim(),
          html: ol_ext_element.create('DIV', { html: b.html }),
          click: b.click,
          on: b.on,
          parent: elt
        })
      }
    }))
  }

  ol_interaction_DragOverlay.call(this, {
    centerOnClick: false,
    //offset: [-20,-20],
    overlays: this.overlay
  });

  // Replace events to handle click
  var dragging = false;
  var start = false;
  this.on('dragstart', function (e) {
    this._pixel = this.getMap().getPixelFromCoordinate(this.overlay.getPosition())
    start = e;
    return !e.overlay;
  })
  this.on('dragend', function (e) {
    this._pixel = this.getMap().getPixelFromCoordinate(this.overlay.getPosition())
    if (!e.overlay) return true;
    if (dragging) {
      this.dispatchEvent({
        type: 'dragend', 
        dragging: dragging,
        originalEvent: e.originalEvent, 
        frameState: e.frameState,
        pixel: this._pixel,
        coordinate: this.overlay.getPosition() 
      });
      dragging = false;
    } else {
      if (e.originalEvent.target === this.overlay.element) {
        this.dispatchEvent({ 
          type: 'click', 
          dragging: dragging,
          originalEvent: e.originalEvent, 
          frameState: e.frameState,
          pixel: this._pixel,
          coordinate: this.overlay.getPosition() 
        });
      }
    }
    return false;
  }.bind(this))
  this.on('dragging', function (e) {
    this._pixel = this.getMap().getPixelFromCoordinate(this.overlay.getPosition());
    if (!e.overlay) return true;
    dragging = true;
    if (start) {
      this.dispatchEvent({ 
        type: 'dragstart', 
        dragging: dragging,
        originalEvent: start.originalEvent, 
        frameState: e.frameState,
        pixel: this._pixel,
        coordinate: start.coordinate
      });
      start = false;
    }
    this.dispatchEvent({ 
      type: 'dragging', 
      dragging: dragging,
      originalEvent: e.originalEvent, 
      frameState: e.frameState,
      pixel: this._pixel,
      coordinate: this.overlay.getPosition() 
    });
    return false;
  }.bind(this))
};
ol_ext_inherits(ol_interaction_TouchCursor, ol_interaction_DragOverlay);

/**
 * Remove the interaction from its current map, if any,  and attach it to a new
 * map, if any. Pass `null` to just remove the interaction from the current map.
 * @param {_ol_Map_} map Map.
 * @api stable
 */
ol_interaction_TouchCursor.prototype.setMap = function(map) {
  // Reset
  if (this.getMap()) {
    this.getMap().removeInteraction(this.ctouch);
    if (this.getActive()) this.getMap().removeOverlay(this.overlay);
  }
  for (let l in this._listeners) ol_Observable_unByKey(l);
  this._listeners = {};

  ol_interaction_DragOverlay.prototype.setMap.call (this, map);

  // Set listeners
  if (this.getMap()) {
    if (this.getActive()) this.getMap().addOverlay(this.overlay);
    this._pixel = this.getMap().getPixelFromCoordinate(this.getPosition());
    this.getMap().addInteraction(this.ctouch);
    var view = this.getMap().getView();
    var offsetPosition = function(e) {
      var center = view.getCenter();
      var pos = this.overlay.getPosition();
      if (pos) {
        this.overlay.setPosition([
          pos[0] + center[0] - e.oldValue[0], 
          pos[1] + center[1] - e.oldValue[1]
        ]); 
      }
    }.bind(this);
    var setPosition = function() {
      if (this._pixel && this.getMap()) {
        this.setPosition(this.getMap().getCoordinateFromPixel(this._pixel));
      }
    }.bind(this);
    // Handle view change 
    if (view) {
      this._listeners.center = view.on('change:center', offsetPosition);
      this._listeners.reso = view.on('change:resolution', setPosition);
      this._listeners.rot = view.on('change:rotation', setPosition);
    }
    this._listeners.view = this.getMap().on ('change:view', function() {
      if (this._listeners.view) {
        ol_Observable_unByKey(this._listeners.view);
        ol_Observable_unByKey(this._listeners.reso)
        ol_Observable_unByKey(this._listeners.rot)
      }
      view = this.getMap().getView();
      if (view) {
        this._listeners.view = view.on('change:center', offsetPosition);
        this._listeners.reso = view.on('change:resolution', changeResolution);
        this._listeners.rot = view.on('change:rotation', setPosition);
      }
    }.bind(this));
    this._listeners.addInteraction = this.getMap().getInteractions().on('add', function(e) {
      // Move on top
      if (!e.element.get('onTop')) {
        this.getMap().removeInteraction(this.ctouch);
        this.getMap().addInteraction(this.ctouch);
      }
    }.bind(this));
  }
};

/**
 * Activate or deactivate the interaction.
 * @param {boolean} active Active.
 * @param {ol.coordinate|null} position position of the cursor (when activating), default viewport center.
 * @observable
 * @api
 */
ol_interaction_TouchCursor.prototype.setActive = function(b, position) {
  if (b!==this.getActive()) {
    ol_interaction_DragOverlay.prototype.setActive.call (this, b);
    this.ctouch.setActive(b);
    if (!b) {
      this.setPosition();
      this.overlay.element.classList.remove('active');
      if (this._activate) clearTimeout(this._activate);
      if (this.getMap()) this.getMap().removeOverlay(this.overlay);
      return;
    } 
    if (position) {
      this.setPosition(position);
    } else if (this.getMap()) {
      this.setPosition(this.getMap().getView().getCenter());
    }
    if (this.getMap()) this.getMap().addOverlay(this.overlay);
    this._activate = setTimeout(function() {
      this.overlay.element.classList.add('active');
    }.bind(this), 100);
  } else if (position) {
    this.setPosition(position);
  }
};

/** Set the position of the target
 * @param {ol.coordinate} coord
 */
ol_interaction_TouchCursor.prototype.setPosition = function (coord) {
  this.overlay.setPosition(coord); 
  if (this.getMap() && coord) {
    this._pixel = this.getMap().getPixelFromCoordinate(coord);
  }
};

/** Offset the target position
 * @param {ol.coordinate} coord
 */
ol_interaction_TouchCursor.prototype.offsetPosition = function (coord) {
  var pos = this.overlay.getPosition();
  if (pos) this.overlay.setPosition([pos[0]+coord[0], pos[1]+coord[1]]); 
};

/** Get the position of the target
 * @return {ol.coordinate}
 */
ol_interaction_TouchCursor.prototype.getPosition = function () {
  return this.overlay.getPosition(); 
};

/** Get cursor overlay
 * @return {ol.Overlay}
 */
ol_interaction_TouchCursor.prototype.getOverlay = function () {
  return this.overlay; 
};

/** Get cursor overlay element
 * @return {Element}
 */
ol_interaction_TouchCursor.prototype.getOverlayElement = function () {
  return this.overlay.element; 
};

/** Get cursor button element
 * @param {string|number} button the button className or the button index
 * @return {Element}
 */
ol_interaction_TouchCursor.prototype.getButtonElement = function (button) {
  if (typeof(button) === 'number') return this.getOverlayElement().getElementsByClassName('ol-button')[button];
  return this.getOverlayElement().getElementsByClassName(button)[0];
};

/** Get cursor button element
 * @param {} options
 *  @param {string} options.className button class name
 *  @param {DOMElement|string} options.html button content
 *  @param {function} options.click onclick function
 *  @param {*} options.on an object with 
 * 
 */
ol_interaction_TouchCursor.prototype.addButton = function (b) {
  var buttons = this.getOverlayElement().getElementsByClassName('ol-button');
  if (buttons.length > 4) {
    console.error('[ol/interaction/TouchCursor~addButton] too many button on the cursor (max=5)...')
    return;
  } 
  ol_ext_element.create('DIV', {
    className: ((b.className||'')+' ol-button').trim(),
    html: ol_ext_element.create('DIV', { html: b.html }),
    click: b.click,
    on: b.on,
    parent: this.getOverlayElement()
  });
  // Reorder buttons
  var start = buttons.length > 4 ? 0 : 1;
  for (let i=0; i<buttons.length; i++) {
    buttons[i].className = buttons[i].className.replace(/ol-button-\d/g, '').trim() + ' ol-button-' + (i+start);
  }
};

export default ol_interaction_TouchCursor
