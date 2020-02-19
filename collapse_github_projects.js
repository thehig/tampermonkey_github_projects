
// ==UserScript==
// @name         Github Projects Column Collapse
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Collapse empty columns on Github Projects Kanban Boards
// @author       David Higgins
// @match        https://github.com/*/*/projects/*
// @grant        none
// @require http://code.jquery.com/jquery-3.4.1.min.js
// ==/UserScript==

(function($) {
  "use strict";
  console.log("Github Projects Column Collapse v0.1");

  /**
   * Check every 1000ms for ${selector}. When no results are found, call callback
   */
  function waitForNoElement(selector, callback) {
    if ($(selector).length === 0) {
      callback();
    } else {
      setTimeout(function() {
        waitForNoElement(selector, callback);
      }, 1000);
    }
  }

  /**
   * Monitor the ${selector} for changes in .val(). Call callback *each time* val() changes.
   *
   * Will almost always call at least once (unless .val() returns null)
   */
  function monitorValue(selector, callback, previousValue = null) {
    var currentValue = $(selector).val();
    if (currentValue !== previousValue) {
      callback();
    }
    setTimeout(function() {
      monitorValue(selector, callback, currentValue);
    }, 1000);
  }

  /**
   * Inject CSS into a <script> tag added to the <head>
   */
  function injectCss() {
    var transitionDuration = 1; // seconds
    var collapsedWidth = 20; // px
    var expandedWidth = 335; // px (Default from Github)
    $("<style>")
      .prop("type", "text/css")
      .html(
        `
/* Set initial width, add transition to all columns */
.project-column {
  max-width: ${expandedWidth}px;
  min-width: ${expandedWidth}px;
  transition: min-width ${transitionDuration}s, max-width ${transitionDuration}s;
}

.project-column .js-filtered-column-card-count {
  transition: opacity ${transitionDuration}s;
}
.project-column .hide-sm.position-relative {
  transition: opacity ${transitionDuration}s;
}

/* Column state when column is empty */
.project-column.empty {
  max-width: ${collapsedWidth}px;
  min-width: ${collapsedWidth}px;
}
/* Column state when column is empty and hovered or dragging */
.dragging .project-column.empty, .project-column.empty:hover {
  max-width: ${expandedWidth}px;
  min-width: ${expandedWidth}px;
}

/* Column Title state when column is empty */
.project-column.empty .hide-sm.position-relative {
  opacity: 0;
}
/* Column Title state when column is hovered or dragging */
.dragging .project-column .hide-sm.position-relative, .project-column:hover .hide-sm.position-relative {
  opacity: 1;
}

/* Results state when column is empty */
.project-column.empty .js-filtered-column-card-count {
  opacity: 0;
}
/* Results state when column is hovered or dragging */
.dragging .project-column .js-filtered-column-card-count, .project-column:hover .js-filtered-column-card-count {
  opacity: 1;
}
`
      )
      .appendTo("head");
  }

  /**
   * Monitor $(selector) for mouse up,down,move to add or remove the '.dragging' class to the $(selector) element
   */
  function detectDragAndDrop(selector) {
    var isDragging = false;
    var isMouseDown = false;
    $(selector)
      .mousedown(function() {
        isMouseDown = true;
        isDragging = false;
      })
      .mousemove(function() {
        if (!isMouseDown || isDragging) return;

        isDragging = true;
        $(selector).addClass("dragging");
      })
      .mouseup(function() {
        if (isDragging) {
          $(selector).removeClass("dragging");
        }
        isMouseDown = false;
        isDragging = false;
      });
  }

  /**
   * Iterate through the project columns and add/remove the ".empty" css class if they have no visible Articles
   */
  function markEmptyColumns() {
    $(".project-column").each(function() {
      var visibleCards = $(
        ".js-project-column-cards article:not(.d-none)",
        this
      );
      var hasNoCards = visibleCards.length === 0;
      // Add or remove the '.empty' css class
      $(this).toggleClass("empty", hasNoCards);
    });
  }

  /**
   * Main entry point. Waits for page to be 'ready' then executes markEmptyColumns()
   */
  function main() {
    $(document).ready(() => {
      waitForNoElement(".project-column include-fragment", () => {
        // Elements are all loaded, no "include-fragment" in project columns

        injectCss();
        detectDragAndDrop("body");
        monitorValue("input.js-card-filter-input", markEmptyColumns);
      });
    });
  }

  /**
   * INIT
   */
  main();
})(window.jQuery.noConflict(true));
