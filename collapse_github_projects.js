// ==UserScript==
// @name         Github Projects Column Collapse
// @namespace    https://github.com/thehig/tampermonkey_github_projects
// @version      0.7
// @description  Collapse empty columns on Github Projects Kanban Boards
// @author       David Higgins
// @match        https://github.com/*/*/projects/*
// @grant        none
// @require http://code.jquery.com/jquery-3.4.1.min.js
// ==/UserScript==

(function($) {
  "use strict";

  var DEBUG_ENABLED = false;
  var debug = DEBUG_ENABLED ? console.log : f => f;
  console.log(
    "Github Projects Column Collapse v0.7 - https://github.com/thehig/tampermonkey_github_projects"
  );

  /**
   * Wrapper to get the column title.
   */
  function title(column) {
    if (!DEBUG_ENABLED) return "Enable Debug";
    return $(".js-project-column-name", column).text();
  }

  /**
   * Check every 1000ms for $(selector). When no results are found, call callback
   */
  function waitForNoElement(selector, callback) {
    if ($(selector).length === 0) {
      // debug(selector, "not found");
      callback();
    } else {
      // debug(selector, "was found. trying again in 1000ms");
      setTimeout(function() {
        waitForNoElement(selector, callback);
      }, 1000);
    }
  }

  /**
   * Inject CSS into a <script> tag added to the <head>
   */
  function injectCss() {
    // debug("injecting CSS");
    var transitionDuration = 1; // seconds
    var collapsedWidth = 20; // px
    var expandedWidth = 355; // px (Default from Github)
    var scale = 0.75; // Scale from 0 to 1 of how large to make the contents of the window
    var inverseScale = parseFloat(1 / scale).toFixed(2) * 100; // Making the width and height using the inverse scale (0 - 100)

    $("<style>")
      .prop("type", "text/css")
      .html(
        `
/* Shrink the page (Zoom out) */
.project-full-screen {
  width: ${inverseScale}% !important;
  height: ${inverseScale}% !important;
  transform: scale(${scale});
  transform-origin: 0 0;
  
  transition: all ${transitionDuration}s ease;
  transition-property: width, height, transform;
}

/* Set initial width, add transition to all columns */
.project-column {
  max-width: ${expandedWidth}px;
  min-width: ${expandedWidth}px;

  transition: all ${transitionDuration}s ease;
  transition-property: min-width, max-width;
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

    function handleMouseUp() {
      if (isDragging) {
        // debug("mousedrag ended");
        $(selector).removeClass("dragging");
      }
      isMouseDown = false;
      isDragging = false;
    }

    $(selector)
      .mousedown(function() {
        // debug("mousedown"); // Very verbose
        isMouseDown = true;
        isDragging = false;
      })
      .mousemove(function() {
        if (!isMouseDown || isDragging) return;
        // debug("mousedrag started");

        isDragging = true;
        $(selector).addClass("dragging");
      })
      // Both drop and mouseup are required as .mouseup is "eaten" by Github Javascript sometimes
      .mouseup(handleMouseUp)
      // but drop doesn't handle dragging when you're not dragging according to Github Javascript (drag mouse without draggable element)
      .on("drop", handleMouseUp);
  }

  /**
   * Create and start a Mutation Observer that watches a given node for DOM changes, calling callback() each time
   */
  function createColumnObserver(column, callback) {
    // debug("Observing", title(column));
    var observer = new MutationObserver(callback);
    observer.observe(column, {
      attributes: true, // hidden/unhidden (through CSS changes) events
      childList: true, // added/removed events
      subtree: true // child (subtree) events
    });
    return observer;
  }

  /**
   * Debounce a function call
   * https://davidwalsh.name/javascript-debounce-function
   */
  function debounce(wait, func, immediate) {
    var timeout;
    return function() {
      var context = this,
        args = arguments;
      var later = function() {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      var callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    };
  }

  /**
   * Mark a column with ".empty" if it has no visible articles
   */
  function toggleCSS(column) {
    // Count visible cards
    var visibleCards = $(
      ".js-project-column-cards article:not(.d-none)",
      column
    );
    var hasNoCards = visibleCards.length === 0;
    var hasEmptyTag = $(column).hasClass("empty");

    // Nothing to change
    if (hasEmptyTag === hasNoCards) return;

    // Add or remove the '.empty' css class
    $(column).toggleClass("empty", hasNoCards);
    // debug("toggleCSS", title(column), hasNoCards);
  }

  /**
   * Main entry point. Waits for page to be 'ready' then monitors columns for changes
   */
  function main() {
    // debug("main");
    $(document).ready(() => {
      // debug("document ready");
      waitForNoElement(".project-column include-fragment", () => {
        // debug("all fragments loaded");

        injectCss();
        detectDragAndDrop("body");

        $(".project-column").each(function() {
          var column = this;
          // debug("Add MutationObserver to", title(column));
          toggleCSS(column); // Mark starting columns that are empty

          // We don't want to trigger our events too often, so we debounce them
          var debouncedEvent = debounce(200, function() {
            toggleCSS(column);
          });

          // Observe the column for changes
          createColumnObserver(column, debouncedEvent);
        });
      });
    });
  }

  /**
   * INIT
   */
  main();
})(window.jQuery.noConflict(true));
