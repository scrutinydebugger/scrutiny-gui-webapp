//    app.ts
//        The main Scrutiny application
//
//   - License : MIT - See LICENSE file.
//   - Project : Scrutiny Debugger (github.com/scrutinydebugger/scrutiny-gui-webapp)
//
//   Copyright (c) 2021-2023 Scrutiny Debugger

import { Datastore } from "./datastore"
import { ServerConnection } from "./server_connection"
import { UI } from "./ui"
import * as logging from "./logging"
import { BaseWidget } from "./base_widget"

import { default as $ } from "@jquery"

export interface AppConfig {
    server: {
        host: string
        port: number
    }
    debug?: boolean
}

// These build details is generated by webpack using the git-revision plugin + define plugin
interface BuildDetails {
    git_version: string | null
    git_commit: string | null
    git_branch: string | null
}

declare const SCRUTINY_VERSION: string
declare const SCRUTINY_COMMITHASH: string
declare const SCRUTINY_BRANCH: string
declare const SCRUTINY_DEBUG: boolean

/**
 * The main Scrutiny application class
 */
export class App {
    /** The app configuration */
    config: AppConfig

    /** List of promises that needs to be resolved before launching the scrutiny.ready event*/
    init_promises: Promise<any>[]

    /** The application main logger */
    logger: logging.Logger

    /** A dedicated logger for event tracking */
    event_logger: logging.Logger

    /** The User interface object */
    ui: UI | null

    /** The main datastore that contains all watchable objects and their value */
    datastore: Datastore

    /** The link to the server. Talks with it through a websocket and implements its API*/
    server_conn: ServerConnection

    /** The build info generated by webpack */
    build_details: BuildDetails

    debug: boolean

    constructor(config: AppConfig) {
        this.config = config
        this.debug = true
        if (typeof this.config.debug !== "undefined") {
            this.debug = this.config.debug
        } else {
            if (typeof SCRUTINY_DEBUG !== "undefined") {
                this.debug = SCRUTINY_DEBUG
            }
        }

        if (this.debug) {
            logging.set_default_level(logging.Level.Debug)
        } else {
            logging.set_default_level(logging.Level.Info)
        }

        this.init_promises = [] // During init stage, multiple promises will be generated. App will be ready when they all complete
        this.logger = logging.getLogger("App")
        this.event_logger = logging.getLogger("events")

        this.ui = null
        // @ts-ignore init_all must be called
        this.datastore = null
        // @ts-ignore init_all must be called
        this.server_conn = null
        // this build details is generated by webpack using the git-revision plugin + define plugin
        this.build_details = {
            git_branch: typeof SCRUTINY_BRANCH !== "undefined" ? (SCRUTINY_BRANCH as string) : null,
            git_commit: typeof SCRUTINY_COMMITHASH !== "undefined" ? (SCRUTINY_COMMITHASH as string) : null,
            git_version: typeof SCRUTINY_VERSION !== "undefined" ? (SCRUTINY_VERSION as string) : null,
        }
    }

    /**
     * Returns a logger with the given name. Shortcut to access the logging module easily in the browser
     * @param name The name of the logger
     * @returns The logger
     */
    getLogger(name: string): logging.Logger {
        return logging.getLogger(name)
    }

    /**
     * Triggers an event in the application. Abstracted for easy unit testing. Uses JQuery in deployment
     * @param name Name of the event
     * @param data_dict Data associated with the event
     */
    trigger_event(name: string, data_dict?: any): void {
        this.event_logger.debug("Triggering event : " + name)
        if (typeof data_dict == "undefined") {
            data_dict = {}
        }
        $(document).trigger(Object.assign({}, { type: name }, data_dict))
    }

    /**
     * Register a event handler
     * @param name Name of the event
     * @param callback The callback to call when this event is received
     */
    on_event(name: string, callback: (data: any) => void) {
        const that = this
        $(document).on(name, function (data: any) {
            that.event_logger.debug("Running event callback: " + name)
            callback(data)
        })
    }

    /**
     * Launch the application. Must be called after init_all()
     */
    launch(): void {
        const that = this
        this.on_event("scrutiny.ready", function (data) {
            $("#loading_mask").hide()
            that.logger.log("App ready.")
        })

        Promise.all(this.init_promises)
            .then(function () {
                that.trigger_event("scrutiny.ready")
            })
            .catch(function () {
                that.logger.error("App cannot start correctly.")
                // Let's trigger a ready anyway.
                // That will make debugging easier because we need the app to fail where there init
                // error cause a problem.

                that.trigger_event("scrutiny.ready")
            })
    }

    /**
     * Makes a unique ID for each template object added to the DOM.
     * @param widget The widget that owns the template
     * @param name The name of the template
     * @returns The template ID
     */
    get_template_id(widget: BaseWidget | string, name: string): string {
        // Return the DOM id a of a template from it's name an creator (the widget that registered it)
        let widget_name: string

        if (typeof widget === "string") {
            widget_name = widget
        } else if (widget instanceof BaseWidget) {
            widget_name = Object.getPrototypeOf(widget).constructor.widget_name()
        } else {
            throw "Cannot get widget name"
        }

        return "template-" + widget_name + "-" + name
    }

    /**
     * Get the DOM element that contains a template identifier by a name and its widget owner
     * @param widget The widget that owns the template
     * @param name The name of the template
     * @returns The DOM template element
     */
    get_template(widget: BaseWidget, name: string): JQuery {
        // Return a copy of the template from it's name and author (author=widget)
        return $($("#" + this.get_template_id(widget, name)).html())
    }

    /**
     * Load a given template file using an ajax call and add it to the DOM
     * @param template_id The DOM ID attributed to the template element
     * @param template_file Filename containing the template content
     */
    load_template(template_id: string, template_file: string): void {
        // Append the template node to the DOM and register a promise for the init stage when
        // the template is done loading through Ajax.
        const that = this
        const promise = new Promise(function (resolve: (value?: unknown) => void, reject: (reason?: any) => void) {
            const template = $("<template id='" + template_id + "'></template>") as JQuery
            $("#template_section").append(template)
            template.load(template_file, "", function (response, status, xhr) {
                if (status == "success") {
                    that.logger.debug(template_file + " loaded")
                    resolve()
                } else {
                    reject(new Error("Could not load template file. " + template_file))
                }
            })
        })

        // Remember that this must be done before firing a "ready" event. See launch()
        this.init_promises.push(promise)
    }

    /**
     * Global initialization for a Widget type (not the instance). Loads CSS and templates
     * @param widget_class The widget to initialize
     */
    init_widget(widget_class: typeof BaseWidget) {
        // Do all necessary initialization for a widget to work in the app.
        // This is done once at initialization, not for each instance.

        // Load all CSS required by the widget
        const css_list = widget_class.css_list() // This is a static method
        const file_prefix = "widgets/" + widget_class.widget_name() + "/"
        for (let i = 0; i < css_list.length; i++) {
            const path = file_prefix + css_list[i]
            $("head").append('<link rel="stylesheet" href="' + path + '" type="text/css" />')
        }

        // Load all templates required by the widget.
        const templates = widget_class.templates() // This is a static method
        const keys = Object.keys(templates)
        for (let i = 0; i < keys.length; i++) {
            const template_name = keys[i]
            let template_file = templates[keys[i]]
            template_file = file_prefix + template_file
            const template_id = this.get_template_id(widget_class.widget_name(), template_name)
            this.load_template(template_id, template_file) // Launch ajax and append template to DOM
        }
    }

    /**
     * Init the application
     */
    init_all(): void {
        this.ui = new UI($("#layout-container")) // Container for Golden Layout
        this.ui.init()
        this.datastore = new Datastore(this)

        this.server_conn = new ServerConnection(this, this.ui, this.datastore)
        this.server_conn.set_endpoint(this.config.server.host, this.config.server.port)

        this.event_logger.disable()
        this.server_conn.comm_logger.disable()

        const that = this
        this.on_event("scrutiny.ready", function () {
            if (that.server_conn != null) {
                that.server_conn.start()
            }
        })
    }

    /**
     * Adds a widget to the application. Must be called after init_all()
     * @param widget_class The widget to add
     */
    add_widget(widget_class: typeof BaseWidget): void {
        if (this.ui == null) {
            throw "App not initialized"
        }
        this.init_widget(widget_class)
        this.ui.register_widget(widget_class, this)
    }

    set_log_level(level: logging.Level) {
        logging.set_default_level(level)
        logging.set_all_levels(level)
    }
}
