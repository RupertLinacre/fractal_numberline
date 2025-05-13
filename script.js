document.addEventListener('DOMContentLoaded', function () {

    // ====================================================================
    // 1. CONFIGURATION
    // ====================================================================
    const CONFIG = {
        initialDomain: [0, 4],
        margins: { top: 70, right: 40, bottom: 70, left: 40 },
        baseMajorTickLength: 10,
        baseMinorTickLength: 6,

        targetMajorTicksOnScreen: 7,

        // Parameters for dynamic visual scaling of MINOR ticks/labels:
        targetPixelSpacingForMinorTickFullSize: 40,
        minVisualScaleForMinorTicks: 0.15,

        epsilon: 1e-9
    };

    // ====================================================================
    // 2. SETUP
    // ====================================================================
    const svg = d3.select("#axis-svg");
    const svgNode = svg.node();
    const containerWidth = svgNode.getBoundingClientRect().width;
    let availableWidth = containerWidth - CONFIG.margins.left - CONFIG.margins.right;

    const baseScale = d3.scaleLinear()
        .domain(CONFIG.initialDomain)
        .range([0, availableWidth]);

    const format = d3.format(".10~g");

    const chartArea = svg.append("g")
        .attr("transform", `translate(${CONFIG.margins.left}, ${CONFIG.margins.top})`);

    const axisLine = chartArea.append("line")
        .attr("class", "axis-line")
        .attr("y1", 0).attr("y2", 0)
        .attr("x1", 0).attr("x2", availableWidth);

    const ticksContainer = chartArea.append("g")
        .attr("class", "ticks-container");

    // ====================================================================
    // 3. TICK COMPUTATION LOGIC
    // ====================================================================
    function calculateTickLevels(currentScale) {
        const [domainMin, domainMax] = currentScale.domain();
        const domainWidth = domainMax - domainMin;

        if (domainWidth <= CONFIG.epsilon) {
            return { ticks: [], majorStep: 1, minorStep: 0.1, exponent: 0 };
        }

        const idealMajorStep = domainWidth / CONFIG.targetMajorTicksOnScreen;
        const exponent = Math.round(Math.log10(idealMajorStep));

        const majorStep = Math.pow(10, exponent);
        const minorStep = Math.pow(10, exponent - 1);

        const ticks = [];

        const startValue = Math.floor(domainMin / minorStep - CONFIG.epsilon) * minorStep;
        const endValue = Math.ceil(domainMax / minorStep + CONFIG.epsilon) * minorStep;

        for (let v = startValue; v <= endValue + CONFIG.epsilon; v += minorStep) {
            let tickValue = v;
            if (Math.abs(tickValue) < CONFIG.epsilon && tickValue !== 0) {
                tickValue = 0;
            }

            const remainderMajor = Math.abs(tickValue / majorStep) % 1;
            const isMajor = (remainderMajor < CONFIG.epsilon || Math.abs(remainderMajor - 1) < CONFIG.epsilon);

            ticks.push({
                value: tickValue,
                isMajor: isMajor
            });
        }
        return { ticks, majorStep, minorStep, exponent };
    }

    // ====================================================================
    // 4. DRAWING / UPDATE AXIS
    // ====================================================================
    function updateAxis(transform) {
        const currentScale = transform.rescaleX(baseScale);
        const tickData = calculateTickLevels(currentScale);

        // Calculate the on-screen pixel distance corresponding to one minorStep.
        // This is used to determine the visual scale for MINOR ticks.
        const pixelDeltaForMinorStep = Math.abs(currentScale(tickData.minorStep) - currentScale(0));

        // Calculate visual scale for MINOR ticks:
        let minorTickVisualScale = Math.min(1.0, pixelDeltaForMinorStep / CONFIG.targetPixelSpacingForMinorTickFullSize);
        minorTickVisualScale = Math.max(CONFIG.minVisualScaleForMinorTicks, minorTickVisualScale);

        if (isNaN(minorTickVisualScale) || !isFinite(minorTickVisualScale)) {
            minorTickVisualScale = CONFIG.minVisualScaleForMinorTicks;
        }

        // --- D3 Data Join for Ticks ---
        ticksContainer.selectAll("g.tick")
            .data(tickData.ticks, d => d.value)
            .join(
                enter => {
                    const g = enter.append("g");
                    const content = g.append("g").attr("class", "tick-content");
                    content.append("line");
                    content.append("text").attr("dy", "0.5em");
                    return g;
                },
                update => update,
                exit => exit.remove()
            )
            // --- Update attributes for ALL ticks (entering or updating) ---
            .attr("class", d => `tick ${d.isMajor ? "major" : "minor"}`)
            .attr("transform", d => `translate(${currentScale(d.value)}, 0)`)

            .select(".tick-content")
            // CRITICAL CHANGE HERE: Apply scaling conditionally
            .attr("transform", d => {
                const visualScale = d.isMajor ? 1.0 : minorTickVisualScale;
                return `scale(${visualScale})`;
            })
            .select("line")
            .attr("y1", 0)
            .attr("y2", d => d.isMajor ? CONFIG.baseMajorTickLength : CONFIG.baseMinorTickLength);

        ticksContainer.selectAll(".tick text")
            .attr("y", d => {
                const baseLength = d.isMajor ? CONFIG.baseMajorTickLength : CONFIG.baseMinorTickLength;
                const currentVisualScale = d.isMajor ? 1.0 : minorTickVisualScale;
                // Add a small offset if the text is very small to avoid overlap with the axis line
                return baseLength + (currentVisualScale < (CONFIG.minVisualScaleForMinorTicks + 0.1) && !d.isMajor ? 2 : 0);
            })
            .text(d => format(d.value));
    }

    // ====================================================================
    // 5. ZOOM BEHAVIOUR
    // ====================================================================
    function zoomed(event) {
        updateAxis(event.transform);
    }

    const zoom = d3.zoom()
        .scaleExtent([1e-7, 1e7])
        .on("zoom", zoomed);

    svg.call(zoom).on("dblclick.zoom", null);

    // ====================================================================
    // 6. INITIAL DRAW & RESIZE HANDLING
    // ====================================================================
    function initializeAxis() {
        const currentTransform = d3.zoomTransform(svgNode);
        updateAxis(currentTransform);
    }

    initializeAxis();

    // Optional: Add a resize listener
    // window.addEventListener('resize', () => {
    //    availableWidth = svgNode.getBoundingClientRect().width - CONFIG.margins.left - CONFIG.margins.right;
    //    baseScale.range([0, availableWidth]);
    //    axisLine.attr("x2", availableWidth);
    //    initializeAxis();
    // });
});