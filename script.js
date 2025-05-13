document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const config = {
        initialDomain: [0, 4],
        margins: { top: 10, right: 40, bottom: 50, left: 40 }, // bottom margin for labels
        baseSizes: {
            majorTickLength: 15,
            minorTickLength: 8,
            majorFontSize: 12, // Base font size in px
            minorFontSize: 10, // Base font size in px
        },
        maxContentScaleFactor: 5, // Content scales up to 5x base size
        tickValuePrecision: 6 // Max decimal places for tick values to avoid floating point issues
    };

    // --- Setup SVG ---
    const container = d3.select("#chart-container");
    const containerRect = container.node().getBoundingClientRect();
    const svgWidth = containerRect.width;
    const svgHeight = 100; // Fixed height for the axis widget

    const svg = container.append("svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight)
        .attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`);

    const chartWidth = svgWidth - config.margins.left - config.margins.right;
    const chartHeight = svgHeight - config.margins.top - config.margins.bottom; // Not really used for 1D, but good practice

    // --- Scales ---
    // Base scale (maps initial domain to pixel range)
    const xScale = d3.scaleLinear()
        .domain(config.initialDomain)
        .range([0, chartWidth]);

    // Keep track of the current zoom transform
    let currentTransform = d3.zoomIdentity;

    // Group for chart content (applying margins)
    const chartArea = svg.append("g")
        .attr("transform", `translate(${config.margins.left}, ${config.margins.top})`);

    // Baseline path
    const baseline = chartArea.append("path")
        .attr("class", "baseline")
        .attr("d", `M0,${chartHeight} H${chartWidth}`); // Positioned at the bottom of the chart area

    // Container for all ticks
    const ticksContainer = chartArea.append("g")
        .attr("class", "ticks-container")
        .attr("transform", `translate(0, ${chartHeight})`); // Position ticks relative to baseline

    // Clip path to prevent ticks spilling out of the chart area
    svg.append("defs").append("clipPath")
        .attr("id", "chart-clip")
        .append("rect")
        .attr("width", chartWidth)
        .attr("height", svgHeight); // Clip height includes space above baseline

    chartArea.attr("clip-path", "url(#chart-clip)");


    // --- Tick Generation Logic ---
    function generateTicks(scale) {
        const domain = scale.domain();
        const domainWidth = domain[1] - domain[0];
        if (domainWidth <= 0) return []; // Avoid errors with invalid domains

        // Choose exponent n such that 10^n is roughly 1/5th of the domain width
        // W / (5 * 10^n) ≈ 1  =>  10^n ≈ W / 5  => n ≈ log10(W/5)
        // Alternative: n = floor(log10(W)) - use the spec's version
        const n = Math.floor(Math.log10(domainWidth));
        const majorStep = Math.pow(10, n);
        const minorStep = majorStep / 10;

        const ticks = [];
        const precisionFactor = Math.pow(10, config.tickValuePrecision);

        // Helper to avoid floating point creep
        const preciseAdd = (a, b) => (Math.round(a * precisionFactor) + Math.round(b * precisionFactor)) / precisionFactor;
        const isMultipleOf = (value, step) => Math.abs(Math.round(value / step) - value / step) * precisionFactor < 1; // Check if value is close to a multiple

        // Generate Major Ticks
        let startMajor = Math.ceil(domain[0] / majorStep) * majorStep;
        // Adjust start if slightly below due to floating point
        if (startMajor < domain[0] && Math.abs(startMajor - domain[0]) / majorStep < 1e-9) {
            startMajor = preciseAdd(startMajor, majorStep);
        }
        for (let v = startMajor; v <= domain[1]; v = preciseAdd(v, majorStep)) {
            // Round to avoid displaying minor floating point inaccuracies
            const roundedValue = Math.round(v * precisionFactor) / precisionFactor;
            ticks.push({ value: roundedValue, type: 'major' });
        }

        // Generate Minor Ticks
        let startMinor = Math.ceil(domain[0] / minorStep) * minorStep;
        if (startMinor < domain[0] && Math.abs(startMinor - domain[0]) / minorStep < 1e-9) {
            startMinor = preciseAdd(startMinor, minorStep);
        }
        for (let v = startMinor; v <= domain[1]; v = preciseAdd(v, minorStep)) {
            if (!isMultipleOf(v, majorStep)) {
                const roundedValue = Math.round(v * precisionFactor) / precisionFactor;
                ticks.push({ value: roundedValue, type: 'minor' });
            }
        }

        // Sort ticks by value just in case
        ticks.sort((a, b) => a.value - b.value);

        // Filter ticks that are slightly outside the scaled range due to calculation details
        const visiblePixelStart = scale(domain[0]);
        const visiblePixelEnd = scale(domain[1]);
        return ticks.filter(tick => {
            const pos = scale(tick.value);
            return pos >= visiblePixelStart && pos <= visiblePixelEnd;
        });
    }

    // Function to format tick values for display
    function formatTickValue(value) {
        // Simple formatting, could be made more sophisticated
        // (e.g., scientific notation for very large/small numbers)
        const absVal = Math.abs(value);
        if (absVal > 0 && (absVal < 1e-4 || absVal > 1e6)) {
            return value.toExponential(1);
        }
        // Attempt to show reasonable precision
        const fixed = value.toFixed(config.tickValuePrecision);
        // Remove trailing zeros after decimal point, but keep integer zeros
        return parseFloat(fixed).toString();
    }


    // --- Update Function ---
    function updateAxis(currentScale, zoomFactor) {
        const ticksData = generateTicks(currentScale);

        // Calculate the scale factor for tick content (size)
        // It grows with zoomFactor but is clamped
        const contentScale = Math.min(zoomFactor, config.maxContentScaleFactor);

        // --- D3 Data Join for Ticks ---
        const tickSelection = ticksContainer.selectAll(".tick")
            .data(ticksData, d => d.value); // Use value as key

        // --- Exit ---
        tickSelection.exit().remove();

        // --- Enter ---
        const tickEnter = tickSelection.enter()
            .append("g")
            .attr("class", d => `tick ${d.type}`); // Add 'major' or 'minor' class

        // Append the inner scaling group
        const contentGroupEnter = tickEnter.append("g")
            .attr("class", "tick-content");

        // Append line to the content group
        contentGroupEnter.append("line")
            .attr("x1", 0)
            .attr("x2", 0)
            .attr("y1", 0)
            .attr("y2", d => d.type === 'major' ? -config.baseSizes.majorTickLength : -config.baseSizes.minorTickLength); // Draw upwards from baseline

        // Append text to the content group
        contentGroupEnter.append("text")
            .attr("x", 0)
            .attr("y", 5) // Position below the baseline
            .attr("dy", "0em") // Adjust vertical alignment if needed
            .attr("font-size", d => d.type === 'major' ? config.baseSizes.majorFontSize : config.baseSizes.minorFontSize);

        // --- Merge (Enter + Update) ---
        const tickMerge = tickEnter.merge(tickSelection);

        // Position the outer <g> based on the data value and current scale
        tickMerge
            .attr("transform", d => `translate(${currentScale(d.value)}, 0)`);

        // Scale the inner <g> (tick-content)
        tickMerge.select(".tick-content")
            .attr("transform", `scale(${contentScale})`);

        // Update text content for all ticks (including entering ones)
        tickMerge.select("text")
            .text(d => formatTickValue(d.value));

        // Ensure line attributes are correct (might be redundant if only set on enter, but safe)
        tickMerge.select("line")
            .attr("y2", d => -(d.type === 'major' ? config.baseSizes.majorTickLength : config.baseSizes.minorTickLength) / contentScale); // Counter-scale length? NO - Scaling group handles it. Keep base lengths.
        // Correction: Base length should be static within the scaled group. The scaling applies to it.
        // So, setting y2 based on type in the ENTER section is sufficient.

        // Update baseline to span the current visible width (it stays fixed vertically)
        // The baseline itself doesn't scale or move with the zoom, just spans the container width.
        // No update needed here as it's static relative to chartArea.
    }


    // --- Zoom Behavior ---
    const zoom = d3.zoom()
        .scaleExtent([1e-6, 1e9]) // Allow deep zoom in both directions
        .extent([[0, 0], [chartWidth, svgHeight]]) // Limit panning area (within chartArea's bounds)
        .translateExtent([[Number.NEGATIVE_INFINITY, 0], [Number.POSITIVE_INFINITY, svgHeight]]) // Allow infinite horizontal panning
        .on("zoom", zoomed);

    // Attach zoom listener to the main SVG
    // Using svg element allows zoom origin to be anywhere over the graphic
    svg.call(zoom);

    function zoomed(event) {
        currentTransform = event.transform;

        // Create the new scale based on the zoom transform
        const newXScale = currentTransform.rescaleX(xScale);

        // Update the axis rendering
        updateAxis(newXScale, currentTransform.k); // Pass zoom factor 'k'
    }

    // --- Initial Render ---
    updateAxis(xScale, 1); // Initial call with base scale and zoom factor 1

}); // End DOMContentLoaded