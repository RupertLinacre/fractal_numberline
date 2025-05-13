document.addEventListener('DOMContentLoaded', function () {

    // ====================================================================
    // 1. CONFIGURATION
    // ====================================================================
    const STATIC_CONFIG = {
        initialDomain: [-0.5, 1.5],
        margins: { top: 70, right: 40, bottom: 70, left: 40 },
        epsilon: 1e-9,
        d3ZoomScaleExtent: [1e-7, 1e7], // Min/max zoom factor for D3
        baseMajorTickLength: 30,     // Fixed: Length of major ticks at full visual scale
        baseMinorTickLength: 20,      // Fixed: Length of minor ticks at full visual scale
        targetMajorTicksOnScreen: 3, // Fixed: Desired approximate number of major ticks visible
    };

    // User-configurable parameters with their defaults
    const APP_CONFIG = {
        minorTickEmergenceScale: 0.01,
        minorTickFullScalePixelSeparation: 200,
        maxMajorLabelFontSizePx: 36,
        maxMinorLabelFontSizePx: 36,
    };

    // ====================================================================
    // 2. SETUP SVG and SCALES
    // ====================================================================
    const svg = d3.select("#axis-svg");
    const svgNode = svg.node();
    let availableWidth;

    const baseScale = d3.scaleLinear();
    const format = d3.format(".10~g");

    const chartArea = svg.append("g");
    const axisLine = chartArea.append("line")
        .attr("class", "axis-line")
        .attr("y1", 0).attr("y2", 0);

    const ticksContainer = chartArea.append("g")
        .attr("class", "ticks-container");

    // ====================================================================
    // 3. UI CONTROLS HANDLING
    // ====================================================================
    function initControls() {
        const controls = document.querySelectorAll('#config-panel input[data-config-key]');
        controls.forEach(input => {
            const key = input.dataset.configKey;
            if (APP_CONFIG.hasOwnProperty(key)) {
                input.value = APP_CONFIG[key]; // Set initial slider position from APP_CONFIG
                const valueDisplay = document.getElementById(`${input.id}Value`);
                if (valueDisplay) valueDisplay.textContent = input.value;
            }

            input.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                APP_CONFIG[key] = value;
                const valueDisplay = document.getElementById(`${e.target.id}Value`);
                if (valueDisplay) valueDisplay.textContent = value;
                initializeAxis(); // Re-render with new config
            });
        });
    }

    // ====================================================================
    // 4. TICK COMPUTATION LOGIC
    // ====================================================================
    function calculateTickLevels(currentScale) {
        const [domainMin, domainMax] = currentScale.domain();
        const domainWidth = domainMax - domainMin;

        if (domainWidth <= STATIC_CONFIG.epsilon || !isFinite(domainWidth)) {
            return { ticks: [], majorStep: 1, minorStep: 0.1, exponent: 0 };
        }

        const idealMajorStep = domainWidth / STATIC_CONFIG.targetMajorTicksOnScreen;
        const exponent = Math.round(Math.log10(idealMajorStep));

        const majorStep = Math.pow(10, exponent);
        const minorStep = Math.pow(10, exponent - 1);

        const ticks = [];
        const startValue = Math.floor(domainMin / minorStep - STATIC_CONFIG.epsilon) * minorStep;
        const endValue = Math.ceil(domainMax / minorStep + STATIC_CONFIG.epsilon) * minorStep;

        for (let v = startValue; v <= endValue + STATIC_CONFIG.epsilon; v += minorStep) {
            let tickValue = v;
            if (Math.abs(tickValue) < STATIC_CONFIG.epsilon * Math.abs(minorStep) && tickValue !== 0) {
                tickValue = 0;
            }

            const remainderMajor = Math.abs(tickValue / majorStep) % 1;
            const isMajor = (remainderMajor < STATIC_CONFIG.epsilon || Math.abs(remainderMajor - 1) < STATIC_CONFIG.epsilon);

            ticks.push({
                value: tickValue,
                isMajor: isMajor
            });
        }
        return { ticks, majorStep, minorStep, exponent };
    }

    // ====================================================================
    // 5. DRAWING / UPDATE AXIS
    // ====================================================================
    function updateAxis(transform) {
        if (!availableWidth || availableWidth <= 0) return;

        const currentScale = transform.rescaleX(baseScale);
        const tickData = calculateTickLevels(currentScale);

        const pixelDeltaForMinorStep = Math.abs(currentScale(tickData.minorStep) - currentScale(0));

        let minorTickVisualScale = 1.0;
        if (APP_CONFIG.minorTickFullScalePixelSeparation > 0 && isFinite(pixelDeltaForMinorStep)) {
            minorTickVisualScale = Math.min(1.0, pixelDeltaForMinorStep / APP_CONFIG.minorTickFullScalePixelSeparation);
        }
        minorTickVisualScale = Math.max(APP_CONFIG.minorTickEmergenceScale, minorTickVisualScale);

        if (isNaN(minorTickVisualScale) || !isFinite(minorTickVisualScale)) {
            minorTickVisualScale = APP_CONFIG.minorTickEmergenceScale;
        }

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
            .attr("class", d => `tick ${d.isMajor ? "major" : "minor"}`)
            .attr("transform", d => {
                const xPos = currentScale(d.value);
                if (!isFinite(xPos)) return "translate(0,0) scale(0)";
                return `translate(${xPos}, 0)`;
            })
            .each(function (d) {
                const tickGroup = d3.select(this);
                const tickContent = tickGroup.select(".tick-content");

                const visualScale = d.isMajor ? 1.0 : minorTickVisualScale;
                tickContent.attr("transform", `scale(${visualScale})`);

                tickContent.select("line")
                    .attr("y1", 0)
                    .attr("y2", d.isMajor ? STATIC_CONFIG.baseMajorTickLength : STATIC_CONFIG.baseMinorTickLength);

                const textBaseLength = d.isMajor ? STATIC_CONFIG.baseMajorTickLength : STATIC_CONFIG.baseMinorTickLength;
                const scaledTextPushDown = (visualScale < (APP_CONFIG.minorTickEmergenceScale + 0.1) && !d.isMajor) ? (2 / visualScale) : 0;

                tickContent.select("text")
                    .attr("y", textBaseLength + scaledTextPushDown + 2)
                    .style("font-size", d.isMajor ? `${APP_CONFIG.maxMajorLabelFontSizePx}px` : `${APP_CONFIG.maxMinorLabelFontSizePx}px`)
                    .text(format(d.value));
            });
    }

    // ====================================================================
    // 6. ZOOM BEHAVIOUR
    // ====================================================================
    const zoom = d3.zoom()
        .scaleExtent(STATIC_CONFIG.d3ZoomScaleExtent)
        .on("zoom", zoomed);

    function zoomed(event) {
        if (event.sourceEvent && event.sourceEvent.type === "dblclick") return;
        updateAxis(event.transform);
    }

    svg.call(zoom).on("dblclick.zoom", null);

    // ====================================================================
    // 7. INITIAL DRAW & RESIZE HANDLING
    // ====================================================================
    function initializeAxis() {
        const containerRect = svgNode.getBoundingClientRect();
        const newContainerWidth = containerRect.width;
        const newContainerHeight = containerRect.height;

        if (newContainerWidth <= 0) return;

        availableWidth = newContainerWidth - STATIC_CONFIG.margins.left - STATIC_CONFIG.margins.right;

        if (availableWidth <= 0) {
            availableWidth = newContainerWidth / 2;
            STATIC_CONFIG.margins.left = newContainerWidth / 4;
            STATIC_CONFIG.margins.right = newContainerWidth / 4;
        }

        svg.attr("viewBox", `0 0 ${newContainerWidth} ${newContainerHeight}`);

        baseScale
            .domain(STATIC_CONFIG.initialDomain)
            .range([0, availableWidth]);

        chartArea
            .attr("transform", `translate(${STATIC_CONFIG.margins.left}, ${STATIC_CONFIG.margins.top})`);

        axisLine
            .attr("x1", 0)
            .attr("x2", availableWidth);

        let currentTransform = d3.zoomTransform(svgNode);
        updateAxis(currentTransform);
    }

    initControls();
    initializeAxis();

    window.addEventListener('resize', () => {
        initializeAxis();
    });
});