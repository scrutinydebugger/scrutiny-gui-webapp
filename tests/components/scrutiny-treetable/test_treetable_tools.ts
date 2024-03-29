//    test_treetable_tools.ts
//        Some tools that provides helpers for quick testing of the tree table plugin
//
//   - License : MIT - See LICENSE file.
//   - Project : Scrutiny Debugger (github.com/scrutinydebugger/scrutiny-gui-webapp)
//
//   Copyright (c) 2021-2023 Scrutiny Debugger

import { scrutiny_treetable, LoadFunctionInterface as TreeTableLoadFn } from "@scrutiny-treetable"
import { default as $ } from "@jquery"
import * as dom_testing_tools from "@tests/dom_testing_tools"

export interface Node {
    cells: string[]
    children?: Record<string, Node>
    no_children?: boolean
}

export type RootNode = Record<string, Node>

export type FlatTree = Record<
    string,
    {
        cells: string[]
        parent: string | null
        no_children?: boolean
    }
>

export function make_flat_tree(data: RootNode): FlatTree {
    const roots = Object.keys(data)
    let result = {} as FlatTree
    for (let i = 0; i < roots.length; i++) {
        $.extend(result, make_flat_tree_recursive(null, data[roots[i]], roots[i]))
    }
    return result
}

function make_flat_tree_recursive(parent: string | null, node: Node, node_name: string, flat_tree?: FlatTree): FlatTree | null {
    if (typeof flat_tree === "undefined") {
        flat_tree = {}
    }

    flat_tree[node_name] = {
        cells: node.cells,
        parent: parent,
        no_children: node.no_children,
    }

    if (typeof node.children !== "undefined") {
        const children_names = Object.keys(node.children)
        for (let i = 0; i < children_names.length; i++) {
            make_flat_tree_recursive(node_name, node.children[children_names[i]], children_names[i], flat_tree)
        }
    }

    if (parent == null) {
        return flat_tree
    } else {
        return null
    }
}

export function get_load_fn(data: RootNode, no_children_nodes: string[] = []): TreeTableLoadFn {
    const flat_tree = make_flat_tree(data)
    return function (node_id: string, tr: JQuery<HTMLTableRowElement>): ReturnType<TreeTableLoadFn> {
        let output: ReturnType<TreeTableLoadFn> = []

        let nodes = Object.keys(flat_tree)
        for (let i = 0; i < nodes.length; i++) {
            if (flat_tree[nodes[i]].parent == node_id) {
                let no_children = false
                if (typeof no_children_nodes.find((s) => s === nodes[i]) !== "undefined") {
                    no_children = true
                }
                output.push({
                    id: nodes[i],
                    tr: dom_testing_tools.make_row_from_content(flat_tree[nodes[i]].cells),
                    no_children: no_children,
                })
            }
        }
        return output
    }
}
