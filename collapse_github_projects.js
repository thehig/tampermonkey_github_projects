// ==UserScript==
// @name         Github Projects Column Collapse
// @namespace    https://github.com/thehig/tampermonkey_github_projects
// @version      0.2
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
  console.log("Github Projects Column Collapse v0.2 - https://github.com/thehig/tampermonkey_github_projects");

  /**
   * Check every 1000ms for ${selector}. When no results are found, call callback
   */
  function waitForNoElement(selector, callback) {
    if ($(selector).length === 0) {
      debug(selector, "not found");
      callback();
    } else {
      debug(selector, "was found. trying again in 1000ms");
      setTimeout(function() {
        waitForNoElement(selector, callback);
      }, 1000);
    }
  }

  /**
   * Inject CSS into a <script> tag added to the <head>
   */
  function injectCss() {
    debug("injecting CSS");
    var transitionDuration = 1; // seconds
    var collapsedWidth = 20; // px
    var expandedWidth = 355; // px (Default from Github)
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

  function title(column) {
    return $(".js-project-column-name", column).text();
  }

  /**
   * Monitor $(selector) for mouse up,down,move to add or remove the '.dragging' class to the $(selector) element
   */
  function detectDragAndDrop(selector) {
    var isDragging = false;
    var isMouseDown = false;
    $(selector)
      .mousedown(function() {
        // debug('mousedown');
        isMouseDown = true;
        isDragging = false;
      })
      .mousemove(function() {
        if (!isMouseDown || isDragging) return;
        debug("mousedrag started");

        isDragging = true;
        $(selector).addClass("dragging");
      })
      .on("drop", function() {
        // Note: This was .mouseup() but it was missing events. The 'drop' event seems to work though
        if (isDragging) {
          debug("mousedrag ended");
          $(selector).removeClass("dragging");
        }
        isMouseDown = false;
        isDragging = false;
      });
  }

  function createColumnObserver(column, callback) {
    var cardsDiv = $(".js-project-column-cards", column)[0];

    // Create an observer instance
    var observer = new MutationObserver(function(mutations) {
      if (mutations.length) {
        debug("column observer trigger", title(column));
        callback(column);
      }
    });

    // Configuration of the observer:
    var config = {
      attributes: true,
      childList: true,
      characterData: true
    };

    // Pass in the target node, as well as the observer options
    debug("Observing", title(column));
    observer.observe(cardsDiv, config);
    return observer;
  }

  function setEmptyCSSTag(column) {
    var visibleCards = $(
      ".js-project-column-cards article:not(.d-none)",
      column
    );
    var hasNoCards = visibleCards.length === 0;
    var hasEmptyTag = $(column).hasClass("empty");

    if (hasEmptyTag === hasNoCards) return;

    // Add or remove the '.empty' css class
    $(column).toggleClass("empty", hasNoCards);
    debug("setEmptyCSSTag", title(column), hasNoCards);
  }

  /**
   * Iterate through the project columns and add/remove the ".empty" css class if they have no visible Articles
   */
  function addDOMwatchers() {
    $(".project-column").each(function() {
      var column = this;
      debug("Add DOM watchers to", title(column));
      setEmptyCSSTag(column); // Run at least once per column

      createColumnObserver(column, function() {
        setEmptyCSSTag(column); // Then for every DOMSubtreeModified event trigger
      });
    });
  }

  /**
   * Main entry point. Waits for page to be 'ready' then executes markEmptyColumns()
   */
  function main() {
    debug("main");
    $(document).ready(() => {
      debug("document ready");
      waitForNoElement(".project-column include-fragment", () => {
        // Elements are all loaded, no "include-fragment" in project columns
        debug("fragments loaded");

        injectCss();
        detectDragAndDrop("body");
        addDOMwatchers();
      });
    });
  }

  /**
   * INIT
   */
  main();
})(window.jQuery.noConflict(true));
