import { Chart, Plugin } from "chart.js/auto"

export interface RemoveUnusedAxesPluginOptions {
    enabled: boolean
}

export const RemoveUnusedAxesPlugin: Plugin = {
    id: "remove_unused_axes",
    defaults: { enabled: true },
    beforeLayout: function (chart: Chart, _args: any, options: RemoveUnusedAxesPluginOptions) {
        if (!options.enabled) {
            return
        }

        let axis_display_map: Record<string, boolean> = {}
        for (let i = 0; i < chart.data.datasets.length; i++) {
            const meta = chart.getDatasetMeta(i)
            if (typeof meta === "undefined") {
                return false
            }
            const y_axis_id = meta.yAxisID
            if (typeof y_axis_id === "undefined") {
                return false
            }

            if (!axis_display_map.hasOwnProperty(y_axis_id)) {
                axis_display_map[y_axis_id] = false
            }

            if (meta.visible) {
                axis_display_map[y_axis_id] = true
            }
        }

        for (let axis_id in axis_display_map) {
            if (axis_display_map.hasOwnProperty(axis_id)) {
                if (!chart.scales.hasOwnProperty(axis_id)) {
                    throw "Axis does not exist " + axis_id
                }
                chart.scales[axis_id].options.display = axis_display_map[axis_id]
            }
        }
    },
}
