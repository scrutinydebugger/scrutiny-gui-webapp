//    scrutiny-focusable.ts
//        Component allowing to make any HTML element focusable using a custom event. Focus
//        are controlled by group meaning 2 items can have focused if they do not share a
//        common root.
//
//   - License : MIT - See LICENSE file.
//   - Project : Scrutiny Debugger (github.com/scrutinydebugger/scrutiny-gui-webapp)
//
//   Copyright (c) 2021-2023 Scrutiny Debugger

import { default as $ } from "jquery"

const CLASS_FOCUSABLE = "scrutiny-focusable"
const CLASS_FOCUSED = "scrutiny-focusable-focused"
const CLASS_FOCUS_ROOT = "scruitny-focusable-root"
const CLASS_ACTIVE_ROOT = "scrutiny-focusable-active-root"
const DATAKEY_OPTIONS = "scrutiny-focusable-options"
const DATAKEY_FOCUSABLE_CHILDREN = "scrutiny-focusable-children"

export const EVENT_FOCUS = "scrutiny-focusable-focus"
export const EVENT_BLUR = "scrutiny-focusable-blur"

const PLUGIN_NAME = "scrutiny-focusable"

const DEFAULT_OPTIONS = {
    root: null as JQuery | null, // The focus group root node in which assign the element. If null, body will be the root
}

type PluginOptionsFull = typeof DEFAULT_OPTIONS
export type PluginOptions = Partial<PluginOptionsFull> // The user doesn't have to specify them all

export interface JQueryFocusable<T> extends JQuery<T> {
    scrutiny_focusable: Function
}

/**
 * Format an error message when throwing an exception
 * @param msg Error message
 * @returns Formatted error message
 */
function _error_msg(msg: string): string {
    return `[${PLUGIN_NAME}]: ${msg}`
}

/**
 * OnClick Callback assigned to each root element, only once
 * @param root Root element of a focus group
 * @param e Event
 */
function _root_click_callback(root: JQuery, e: JQuery.ClickEvent) {
    let root_id_string = root.attr("id")
    if (!root_id_string) {
        root_id_string = root[0].tagName
    }
    const to_blur = root.find(`.${CLASS_FOCUSED}`).not($(e.target))
    to_blur.removeClass(CLASS_FOCUSED)
    to_blur.trigger(EVENT_BLUR)
}

/**
 * Retourn the active root, meaning which is the last focus group the user has selected. Can be none
 * @returns Active root
 */
function _get_active_root(): JQuery {
    let active_root = $(`.${CLASS_ACTIVE_ROOT}`)
    return active_root
}

const _global_init = (function () {
    let executed = false
    return function () {
        if (!executed) {
            executed = true
            _global_init_body()
        }
    }
})()

/**
 * Add a global body handlers to manage focus groups.
 */
function _global_init_body() {
    const body = $("body") as JQuery<HTMLBodyElement>
    // Switch the active group based on where the target is
    body.on("click", function (e: JQuery.ClickEvent) {
        let new_active_root = $(e.target).parents(`.${CLASS_FOCUS_ROOT}:first`).first()
        _get_active_root().removeClass(CLASS_ACTIVE_ROOT)
        new_active_root.addClass(CLASS_ACTIVE_ROOT)
    })

    // If escape key is pressed, blur active element in active focus group
    body.on("keydown", function (e) {
        if (e.key == "Escape") {
            const to_blur = _get_active_root().find(`.${CLASS_FOCUSED}`)
            to_blur.removeClass(CLASS_FOCUSED)
            to_blur.trigger(EVENT_BLUR)
        }
    })
}

/**
 * Return the element that has the focus within a focus group identified by a root node
 * @param root The root of the focus group
 * @returns Focused element
 */
function get_focused(root: JQueryFocusable<HTMLElement>) {
    if (!root.hasClass(CLASS_FOCUS_ROOT)) {
        throw _error_msg("Node is not a valid focus group root")
    }
    return root.find(`.${CLASS_FOCUSED}`)
}

/**
 * Tells if an element is being used as a focus group root node
 * @param root Root node
 * @returns true if node is a root node
 */
function is_active_root(root: JQueryFocusable<HTMLElement>) {
    if (!root.hasClass(CLASS_FOCUS_ROOT)) {
        throw _error_msg("Node is not a valid focus group root")
    }
    return root.hasClass(CLASS_ACTIVE_ROOT)
}

/**
 * Tells if an element has the focus wihin its group
 * @param $element Element that could be focused
 * @returns true if the element has focus iwthin its group
 */
function is_focused($element: JQueryFocusable<HTMLElement>) {
    if (!$element.hasClass(CLASS_FOCUSABLE)) {
        throw _error_msg("Node is not a valid focusable element")
    }
    return $element.hasClass(CLASS_FOCUSED)
}

/**
 * Initialize the plugin on a Jquery element
 * @param $element Element to make focusable
 * @param config The plugin configuration
 */
function init($element: JQuery, config?: PluginOptions): void {
    _global_init()
    const options: PluginOptionsFull = $.extend({}, DEFAULT_OPTIONS, config)
    $element.data(DATAKEY_OPTIONS, options)
    $element.addClass(CLASS_FOCUSABLE)
    $element.attr
    const root = options.root !== null ? options.root : $("body").first()

    if (root.find($element).length == 0) {
        throw _error_msg("root is not the parent of the focusable element")
    }

    if (!root.hasClass(CLASS_FOCUS_ROOT)) {
        root.data(DATAKEY_FOCUSABLE_CHILDREN, $())
        root.addClass(CLASS_FOCUS_ROOT)
        root.on("click", function (e) {
            _root_click_callback(root, e)
        })
    }

    $element.on("DOMNodeRemoved", function () {
        root.data(DATAKEY_FOCUSABLE_CHILDREN, root.data(DATAKEY_FOCUSABLE_CHILDREN).not($element))
    })

    root.data(DATAKEY_FOCUSABLE_CHILDREN, root.data(DATAKEY_FOCUSABLE_CHILDREN).add($element))

    $element.on("click", function (e) {
        if ($element.is($(e.target)) && !$element.hasClass(CLASS_FOCUSED)) {
            $element.addClass(CLASS_FOCUSED)
            $element.trigger(EVENT_FOCUS)
        }
    })
}

// public functions
const public_funcs = {
    init: init,
    get_focused: get_focused,
    is_focused: is_focused,
    is_active_root: is_active_root,
}

export function scrutiny_focusable(...args: any[]) {
    let hasResults = false
    //@ts-ignore
    const results = $(this).map(function () {
        const $element = $(this)

        // Jquery plugin like approach.
        if (args.length < 1) throw "Missing arguments"
        if (typeof args[0] === "string") {
            const funcname = args[0]
            if (!public_funcs.hasOwnProperty(funcname)) {
                throw _error_msg("Unknown function " + funcname)
            }
            //@ts-ignore
            const result = public_funcs[funcname]($element, ...args.slice(1))
            if (typeof result !== "undefined") {
                hasResults = true
                return result
            }
        } else {
            init($element, args[0])
        }
    })

    // When no result were provided, return the same `this` that we received
    if (!hasResults) {
        //@ts-ignore
        return this
    }
    // optionally, when there was only one item targeted, return the result
    // directly
    else if (results.length === 1) {
        return results[0]
    }
    // otherwise return the jQuery mapped results.
    else {
        return results
    }
}
