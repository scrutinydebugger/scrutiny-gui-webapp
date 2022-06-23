class VarListWidget {

    constructor(container, app) {
        this.container = container
        this.app = app
    }

    initialize() {

        if (typeof(VarListWidget.next_instance_id) === 'undefined') {
            VarListWidget.next_instance_id = 0;
        } else {
            VarListWidget.next_instance_id++
        }
        this.instance_id = VarListWidget.next_instance_id
        this.treename = 'varlist_tree_' + this.instance_id

        let that = this

        this.container.html("");
        this.container.append($("<div class='type-filter'></div>"))
        this.container.append($("<div class='tree-container'></div>"))

        // Event handlers
        $(document).on('scrutiny.datastore.ready', function() {
            that.rebuild_tree()
        })

        $(document).on('scrutiny.datastore.clear', function() {
            that.clear()
        })

        $("#test_drop").on('drop', function(e) {
            e.preventDefault()

            $(this).text(e.originalEvent.dataTransfer.getData('display_path'))
        })

        $("#test_drop").on('dragover', function(e) {
            e.preventDefault()
        })

        // Setup
        if (this.app.datastore.is_ready()) {
            that.rebuild_tree()
        }

        this.active_filter = null

        let template = this.app.get_template(this, 'entry_type_filter')
        template.find('button.toggle-button').click(function(e) {
            let target = $(e.target)
            let filter_str = target.attr('filter')

            target.siblings('button.toggle-button').removeClass('active')
            target.addClass('active')
            if (filter_str === 'all') {
                this.active_filter = null
            } else if (filter_str === 'alias') {
                this.active_filter = DatastoreEntryType.Alias
            } else if (filter_str === 'var') {
                this.active_filter = DatastoreEntryType.Var
            } else if (filter_str === 'did') {
                this.active_filter = DatastoreEntryType.Did
            }
        })
        this.container.find('.type-filter').append(template)
    }

    make_node_id(display_path) {
        return this.treename + '_' + display_path.replaceAll('/', '_')
    }


    fetch_jstree_subnodes(parent, callback) {
        // jstree root has id="#"
        let that = this
        if (parent.id == "#") {
            let display_path = '/'
            callback([{
                "text": "/",
                "id": that.make_node_id(display_path),
                "children": true,
                'li_attr': {
                    "display_path": display_path
                }
            }]);
        } else {
            let children = this.app.datastore.get_children(parent.li_attr.display_path)
            let jstree_childrens = []
                // Add folders node
            children['subfolders'].forEach(function(subfolder, i) {
                let separator = (parent.li_attr.display_path === "/") ? "" : "/"
                let display_path = parent.li_attr.display_path + separator + subfolder.name
                jstree_childrens.push({
                    'text': subfolder.name,
                    'children': subfolder.children, // true if it has children
                    'id': that.make_node_id(display_path),
                    'li_attr': {
                        "display_path": display_path
                    }
                })
            })

            // Add entries node
            Object.keys(DatastoreEntryType).forEach(function(typeval, i) {
                let entry_type = DatastoreEntryType[typeval]
                    // Entries are organized by entry type
                children['entries'][entry_type].forEach(function(entry, i) {
                    let display_path = entry.display_path
                    jstree_childrens.push({
                        'text': entry.name,
                        'id': that.make_node_id(display_path),
                        'li_attr': {
                            "display_path": display_path
                        },
                        "icon": "jstree-file"
                    })
                })
            })

            callback(jstree_childrens) // This callback adds the subnodes
        }
    }

    get_tree_container() {
        return this.container.find('.tree-container');
    }

    // called on datastore ready event
    rebuild_tree() {
        this.clear()
        let tree_name = 'varlist' + this.instance_id;
        let that = this
        let ds = this.app.datastore

        let thetree = $("<div class='varlist-tree'></div>").jstree({
            'plugins': ["dnd"], // Drag and drop
            'core': {
                'data': function(obj, cb) {
                    that.fetch_jstree_subnodes(obj, cb)
                },
                'animation': 75,
                'themes': {
                    "variant": "small"
                }
            }
        });

        this.get_tree_container().append(thetree)

    }

    // called on datastore clear event
    clear() {
        this.get_tree_container().html("")
    }

    static name() {
        return 'varlist';
    }
    static display_name() {
        return 'Variable List';
    }

    static icon_path() {
        return 'assets/img/treelist-96x128.png';
    }

    static css_list() {
        return ['varlist.css']
    }

    static templates() {
        return {
            'entry_type_filter': 'templates/entry_type_filter.html'
        }
    }
}