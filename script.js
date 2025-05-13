document.addEventListener('DOMContentLoaded', function () {

    // ====================================================================
    // 1. CONFIGURATION
    // ====================================================================
    const CONFIG = {
        initialDomain: [0, 4],
        margins: { top: 70, right: 40, bottom: 70, left: 40 },
        baseMajorTickLength: 10,
        baseMinorTickLength: 6,
        maxVisualScaleFactor: 1.5, // Clamp visual size growth (e.g., 1.0 = 100% of base, 2.0=200%)
        targetMajorTicks: 7,      // Try to get around this many major ticks on screen
        epsilon: 1e-9             // For floating point comparisons
    };

    // ====================================================================
    // 2. SETUP
    // ====================================================================
    const svg = d3.select("#axis-svg");

    // Measure available size
    const svgNode = svg.node();
    const width = svgNode.getBoundingClientRect().width - CONFIG.margins.left - CONFIG.margins.right;
    const height = svgNode.getBoundingClientRect().height - CONFIG.margins.top - CONFIG.margins.bottom;

    // Base Scale (maps data domain to pixel range)
    const baseScale = d3.scaleLinear()
        .domain(CONFIG.initialDomain)
        .range([0, width]);

    // Formatter
    const format = d3.format(".10~g"); // General format, 10 sig-figs, trims trailing 0s

    // SVG Structure
    const chartArea = svg.append("g")
        .attr("transform", `translate(${CONFIG.margins.left}, ${CONFIG.margins.top})`);

    const axisLine = chartArea.append("line")
        .attr("class", "axis-line")
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("x1", 0)
        .attr("x2", width);

    const ticksContainer = chartArea.append("g")
        .attr("class", "ticks-container");

    // ====================================================================
    // 3. TICK COMPUTATION LOGIC
    // ====================================================================
    function getTicks(scale) {
        const [domainMin, domainMax] = scale.domain();
        const domainWidth = domainMax - domainMin;

        if (domainWidth <= 0) return []; // Avoid log(0) or negative

        // Calculate desired step based on target tick count
        const exponent = Math.ceil(Math.log10(domainWidth / CONFIG.targetMajorTicks));

        const majorStep = Math.pow(10, exponent);
        const minorStep = Math.pow(10, exponent - 1);

        const ticks = [];

        // Calculate tick range, extending slightly to ensure smooth edges if needed
        const startValue = Math.floor(domainMin / minorStep) * minorStep;
        const endValue = Math.ceil(domainMax / minorStep) * minorStep;

        // Generate Minor Ticks, identify Majors
        for (let v = startValue; v <= endValue; v += minorStep) {
            // Use epsilon to avoid floating point modulo issues
            const remainder = Math.abs(v / majorStep) % 1;
            const isMajor = (remainder < CONFIG.epsilon || Math.abs(remainder - 1) < CONFIG.epsilon);

            ticks.push({
                value: v,
                isMajor: isMajor
            });
        }
        return ticks;
    }

    // ====================================================================
    // 4. DRAWING / UPDATE
    // ====================================================================
    function updateAxis(transform) {

        // Calculate the scale for the CURRENT view
        const currentScale = transform.rescaleX(baseScale);

        // Calculate how much to scale the tick-marks/text visually
        const visualScale = Math.min(transform.k, CONFIG.maxVisualScaleFactor);

        // Get the ticks needed for this scale
        const ticks = getTicks(currentScale);

        // --- D3 Data Join ---
        ticksContainer.selectAll("g.tick")
            .data(ticks, d => d.value) // Keyed by value
            .join(
                enter => { // CREATE new ticks
                    const g = enter.append("g")
                        .attr("class", "tick");

                    // Add the INNER group that will be scaled
                    const content = g.append("g")
                        .attr("class", "tick-content");

                    // Add Line and Text INSIDE the scaling group
                    content.append("line");
                    content.append("text")
                        .attr("dy", "0.5em"); // Offset below the line, using em allows it to scale with font-size

                    return g; // Return the outer group
                },
                update => update, // Nothing extra needed for update selection here
                exit => exit.remove() // REMOVE old ticks
            )
            // UPDATE attributes on ALL (entering + updating) ticks
            .attr("class", d => d.isMajor ? "tick major" : "tick minor")
            .attr("transform", d => `translate(${currentScale(d.value)}, 0)`) // 1. POSITION outer group
            .select(".tick-content") // Select inner group
            .attr("transform", `scale(${visualScale})`) // 2. SCALE inner group
            .select("line")
            .attr("y1", 0)
            .attr("y2", d => d.isMajor ? CONFIG.baseMajorTickLength : CONFIG.baseMinorTickLength);

        ticksContainer.selectAll(".tick-content text") // Update text on all ticks
            .attr("y", d => d.isMajor ? CONFIG.baseMajorTickLength : CONFIG.baseMinorTickLength) // Position text below line
            .text(d => format(d.value));
    }


    // ====================================================================
    // 5. ZOOM BEHAVIOUR
    // ====================================================================
    function zoomed(event) {
        // Update axis synchronously using the latest transform
        updateAxis(event.transform);
    }

    const zoom = d3.zoom()
        .scaleExtent([1e-6, 1e9]) // Allow huge zoom range
        // .translateExtent([[-Infinity, -Infinity],[Infinity, Infinity]]) // Allow infinite pan
        .on("zoom", zoomed);

    svg.call(zoom);

    // ====================================================================
    // 6. INITIAL DRAW
    // ====================================================================
    updateAxis(d3.zoomIdentity); // d3.zoomIdentity is a transform with k=1, x=0, y=0

}); // End DOMContentLoaded