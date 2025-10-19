<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as d3 from 'd3';
  import type { GraphNode, GraphEdge, DelegationGraphData } from '../services/graphData';
  import { traceDelegationPath, getGraphStats } from '../services/graphData';

  export let graphData: DelegationGraphData;
  export let width = 800;
  export let height = 600;
  export let compact = false; // Compact mode for sidebar
  export let topicName: string | null = null; // Optional topic name override

  let svgElement: SVGSVGElement;
  let selectedNode: GraphNode | null = null;
  let highlightedPath: string[] = [];
  let showExportMenu = false;

  // D3 simulation
  let simulation: d3.Simulation<GraphNode, GraphEdge> | null = null;

  // Color scheme - Dark theme
  const colors = {
    terminal: '#10b981',      // Green for terminal delegates with power
    delegating: '#6366f1',    // Indigo for delegating nodes
    user: '#c084fc',          // Purple for connected user
    inactive: '#6b7280',      // Gray for inactive nodes
    edge: '#4b5563',          // Dark gray for edges
    edgeHighlight: '#818cf8', // Light indigo for highlighted path
  };

  onMount(() => {
    if (graphData.nodes.length === 0) {
      return;
    }

    createGraph();
  });

  onDestroy(() => {
    if (simulation) {
      simulation.stop();
    }
  });

  function createGraph() {
    // Clear existing graph
    d3.select(svgElement).selectAll('*').remove();

    const svg = d3.select(svgElement);

    // Create container for zoom/pan
    const g = svg.append('g');

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Create force simulation
    simulation = d3.forceSimulation(graphData.nodes)
      .force('link', d3.forceLink(graphData.edges)
        .id((d: any) => d.id)
        .distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    // Create arrow markers for directed edges
    svg.append('defs').selectAll('marker')
      .data(['arrow', 'arrow-highlight'])
      .join('marker')
      .attr('id', d => d)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', d => d === 'arrow-highlight' ? colors.edgeHighlight : colors.edge);

    // Create edges
    const link = g.append('g')
      .selectAll('line')
      .data(graphData.edges)
      .join('line')
      .attr('class', 'edge')
      .attr('stroke', colors.edge)
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrow)')
      .attr('opacity', 0.6);

    // Create nodes
    const node = g.append('g')
      .selectAll('g')
      .data(graphData.nodes)
      .join('g')
      .attr('class', 'node')
      .call(drag(simulation) as any);

    // Add circles to nodes
    node.append('circle')
      .attr('r', (d: GraphNode) => {
        // Size based on voting power
        if (d.votingPower > 0) {
          return 10 + Math.sqrt(d.votingPower) * 3;
        }
        return 10;
      })
      .attr('fill', (d: GraphNode) => {
        if (d.isUser) return colors.user;
        if (d.isTerminal && d.votingPower > 0) return colors.terminal;
        if (d.isDelegating) return colors.delegating;
        return colors.inactive;
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer');

    // Add labels to nodes
    node.append('text')
      .text((d: GraphNode) => d.label)
      .attr('x', 0)
      .attr('y', -15)
      .attr('text-anchor', 'middle')
      .attr('font-size', compact ? '9px' : '10px')
      .attr('fill', '#e5e7eb')
      .attr('font-weight', (d: GraphNode) => d.isTerminal && d.votingPower > 0 ? 'bold' : 'normal');

    // Add voting power badges for terminal delegates
    node.filter((d: GraphNode) => d.votingPower > 0)
      .append('text')
      .text((d: GraphNode) => `⚡${d.votingPower}`)
      .attr('x', 0)
      .attr('y', 4)
      .attr('text-anchor', 'middle')
      .attr('font-size', '9px')
      .attr('fill', '#fff')
      .attr('font-weight', 'bold');

    // Node interactions
    node.on('click', (event, d: GraphNode) => {
      event.stopPropagation();
      handleNodeClick(d);
    });

    node.on('mouseenter', (event, d: GraphNode) => {
      // Highlight node on hover
      d3.select(event.currentTarget).select('circle')
        .attr('stroke-width', 4);
    });

    node.on('mouseleave', (event) => {
      d3.select(event.currentTarget).select('circle')
        .attr('stroke-width', 2);
    });

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    // Click on background to deselect
    svg.on('click', () => {
      selectedNode = null;
      highlightedPath = [];
      updateHighlights();
    });
  }

  function handleNodeClick(node: GraphNode) {
    selectedNode = node;

    // Trace delegation path from this node
    highlightedPath = traceDelegationPath(graphData, node.address);

    updateHighlights();
  }

  function updateHighlights() {
    if (!svgElement) return;

    const svg = d3.select(svgElement);

    // Update edge highlights
    svg.selectAll('.edge')
      .attr('stroke', (d: any) => {
        const edge = d as GraphEdge;
        const isHighlighted = highlightedPath.length > 1 && (
          highlightedPath.some((addr, i) => {
            if (i === highlightedPath.length - 1) return false;
            return addr.toLowerCase() === edge.source.id?.toLowerCase() &&
                   highlightedPath[i + 1].toLowerCase() === edge.target.id?.toLowerCase();
          })
        );
        return isHighlighted ? colors.edgeHighlight : colors.edge;
      })
      .attr('stroke-width', (d: any) => {
        const edge = d as GraphEdge;
        const isHighlighted = highlightedPath.length > 1 && (
          highlightedPath.some((addr, i) => {
            if (i === highlightedPath.length - 1) return false;
            return addr.toLowerCase() === edge.source.id?.toLowerCase() &&
                   highlightedPath[i + 1].toLowerCase() === edge.target.id?.toLowerCase();
          })
        );
        return isHighlighted ? 4 : 2;
      })
      .attr('marker-end', (d: any) => {
        const edge = d as GraphEdge;
        const isHighlighted = highlightedPath.length > 1 && (
          highlightedPath.some((addr, i) => {
            if (i === highlightedPath.length - 1) return false;
            return addr.toLowerCase() === edge.source.id?.toLowerCase() &&
                   highlightedPath[i + 1].toLowerCase() === edge.target.id?.toLowerCase();
          })
        );
        return isHighlighted ? 'url(#arrow-highlight)' : 'url(#arrow)';
      });

    // Update node highlights
    svg.selectAll('.node circle')
      .attr('opacity', (d: any) => {
        const node = d as GraphNode;
        if (highlightedPath.length === 0) return 1;
        return highlightedPath.some(addr => addr.toLowerCase() === node.address.toLowerCase()) ? 1 : 0.3;
      });
  }

  function drag(simulation: d3.Simulation<GraphNode, GraphEdge>) {
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended);
  }

  $: stats = getGraphStats(graphData);

  $: {
    // Recreate graph when data changes
    if (svgElement && graphData.nodes.length > 0) {
      createGraph();
    }
  }

  function exportAsSVG() {
    if (!svgElement) return;

    // Clone the SVG element
    const svgClone = svgElement.cloneNode(true) as SVGSVGElement;

    // Add white background
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('width', '100%');
    bgRect.setAttribute('height', '100%');
    bgRect.setAttribute('fill', 'white');
    svgClone.insertBefore(bgRect, svgClone.firstChild);

    // Serialize SVG
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgClone);

    // Create blob and download
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `delegation-graph-topic-${graphData.topicId}.svg`;
    link.click();

    // Cleanup
    URL.revokeObjectURL(url);
    showExportMenu = false;
  }

  function exportAsPNG() {
    if (!svgElement) return;

    // Create canvas
    const canvas = document.createElement('canvas');
    const scale = 2; // Higher quality
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Clone and serialize SVG
    const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgClone);

    // Create image from SVG
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Download PNG
      canvas.toBlob((blob) => {
        if (blob) {
          const pngUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = pngUrl;
          link.download = `delegation-graph-topic-${graphData.topicId}.png`;
          link.click();
          URL.revokeObjectURL(pngUrl);
        }
      });

      URL.revokeObjectURL(url);
      showExportMenu = false;
    };

    img.src = url;
  }

  function copyGraphData() {
    const data = {
      topic: graphData.topicId,
      stats: stats,
      nodes: graphData.nodes.map(n => ({
        address: n.address,
        votingPower: n.votingPower,
        isTerminal: n.isTerminal,
        isDelegating: n.isDelegating
      })),
      edges: graphData.edges.map(e => ({
        from: e.source,
        to: e.target
      }))
    };

    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    alert('Graph data copied to clipboard!');
    showExportMenu = false;
  }
</script>

<div class="graph-container" class:compact>
  <div class="graph-header">
    <div class="header-left">
      <h3>
        {#if topicName}
          {topicName}
        {:else if graphData.topicId === -1}
          Global Delegation Network
        {:else}
          Topic {graphData.topicId}
        {/if}
      </h3>
      <div class="stats">
        <span class="stat">👥 {stats.totalVoters} voters</span>
        <span class="stat">⚡ {stats.terminalDelegateCount} terminal delegates</span>
        <span class="stat">🔗 {stats.maxChainLength} max chain</span>
        <span class="stat">📊 {stats.maxVotingPower} max power</span>
      </div>
    </div>
    <div class="export-container">
      <button class="export-btn" on:click={() => showExportMenu = !showExportMenu}>
        📥 Export
      </button>
      {#if showExportMenu}
        <div class="export-menu">
          <button class="export-option" on:click={exportAsSVG}>
            💾 Download SVG
          </button>
          <button class="export-option" on:click={exportAsPNG}>
            🖼️ Download PNG
          </button>
          <button class="export-option" on:click={copyGraphData}>
            📋 Copy JSON Data
          </button>
        </div>
      {/if}
    </div>
  </div>

  <div class="graph-legend">
    <div class="legend-item">
      <div class="legend-circle" style="background: {colors.terminal}"></div>
      <span>Terminal Delegate</span>
    </div>
    <div class="legend-item">
      <div class="legend-circle" style="background: {colors.delegating}"></div>
      <span>Delegating</span>
    </div>
    <div class="legend-item">
      <div class="legend-circle" style="background: {colors.user}"></div>
      <span>You</span>
    </div>
    <div class="legend-item">
      <div class="legend-circle" style="background: {colors.inactive}"></div>
      <span>Inactive</span>
    </div>
  </div>

  <svg bind:this={svgElement} {width} {height} class="delegation-graph">
    <!-- D3 will render here -->
  </svg>

  {#if selectedNode}
    <div class="node-details">
      <h4>Selected Node</h4>
      <p><strong>Address:</strong> {selectedNode.address}</p>
      <p><strong>Voting Power:</strong> {selectedNode.votingPower}</p>
      <p><strong>Status:</strong>
        {#if selectedNode.isTerminal && selectedNode.votingPower > 0}
          Terminal Delegate
        {:else if selectedNode.isDelegating}
          Delegating
        {:else}
          Not Delegating
        {/if}
      </p>
      {#if highlightedPath.length > 1}
        <p><strong>Delegation Path:</strong></p>
        <div class="path">
          {#each highlightedPath as address, i}
            <span class="path-node">{address.slice(0, 6)}...{address.slice(-4)}</span>
            {#if i < highlightedPath.length - 1}
              <span class="path-arrow">→</span>
            {/if}
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <div class="graph-instructions">
    <p>💡 <strong>Click</strong> a node to see delegation path • <strong>Drag</strong> nodes to rearrange • <strong>Scroll</strong> to zoom</p>
  </div>
</div>

<style>
  .graph-container {
    background: #111827;
    border-radius: 8px;
    padding: 15px;
    border: 1px solid #374151;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    overflow: hidden;
  }

  .graph-container.compact {
    padding: 10px;
  }

  .graph-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
    gap: 15px;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }

  .header-left {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .graph-header h3 {
    margin: 0 0 8px 0;
    color: #f3f4f6;
    font-size: 16px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .compact .graph-header h3 {
    font-size: 14px;
  }

  .export-container {
    position: relative;
  }

  .export-btn {
    padding: 6px 12px;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
  }

  .export-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.5);
  }

  .export-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 8px;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 6px;
    box-shadow: 0 8px 20px rgba(0,0,0,0.5);
    z-index: 10;
    min-width: 180px;
  }

  .export-option {
    display: block;
    width: 100%;
    padding: 10px 16px;
    background: transparent;
    border: none;
    text-align: left;
    font-size: 13px;
    color: #d1d5db;
    cursor: pointer;
    transition: all 0.2s;
    border-bottom: 1px solid #374151;
  }

  .export-option:last-child {
    border-bottom: none;
    border-radius: 0 0 6px 6px;
  }

  .export-option:first-child {
    border-radius: 6px 6px 0 0;
  }

  .export-option:hover {
    background: #374151;
    color: #818cf8;
  }

  .stats {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }

  .stat {
    font-size: 11px;
    color: #d1d5db;
    background: #1f2937;
    padding: 3px 8px;
    border-radius: 10px;
    border: 1px solid #374151;
  }

  .compact .stat {
    font-size: 10px;
    padding: 2px 6px;
  }

  .graph-legend {
    display: flex;
    gap: 12px;
    margin-bottom: 10px;
    padding: 8px;
    background: #1f2937;
    border-radius: 6px;
    flex-wrap: wrap;
    border: 1px solid #374151;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }

  .compact .graph-legend {
    gap: 8px;
    padding: 6px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: #d1d5db;
  }

  .compact .legend-item {
    font-size: 10px;
  }

  .legend-circle {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid #374151;
  }

  .delegation-graph {
    border: 1px solid #374151;
    border-radius: 6px;
    background: #0f1419;
    cursor: grab;
    max-width: 100%;
    height: auto;
    display: block;
  }

  .delegation-graph:active {
    cursor: grabbing;
  }

  .node-details {
    margin-top: 12px;
    padding: 12px;
    background: rgba(99, 102, 241, 0.1);
    border: 1px solid #6366f1;
    border-radius: 6px;
  }

  .compact .node-details {
    padding: 10px;
  }

  .node-details h4 {
    margin: 0 0 8px 0;
    color: #a5b4fc;
    font-size: 14px;
    font-weight: 600;
  }

  .compact .node-details h4 {
    font-size: 12px;
  }

  .node-details p {
    margin: 4px 0;
    font-size: 12px;
    color: #d1d5db;
  }

  .compact .node-details p {
    font-size: 11px;
  }

  .path {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
    padding: 6px;
    background: #1f2937;
    border-radius: 4px;
    border: 1px solid #374151;
  }

  .path-node {
    font-family: 'Monaco', 'Courier New', monospace;
    font-size: 10px;
    background: rgba(129, 140, 248, 0.2);
    padding: 2px 6px;
    border-radius: 3px;
    color: #a5b4fc;
  }

  .path-arrow {
    color: #818cf8;
    font-weight: bold;
  }

  .graph-instructions {
    margin-top: 10px;
    padding: 8px;
    background: rgba(192, 132, 252, 0.1);
    border: 1px solid #8b5cf6;
    border-radius: 6px;
  }

  .compact .graph-instructions {
    padding: 6px;
  }

  .graph-instructions p {
    margin: 0;
    font-size: 11px;
    color: #d1d5db;
  }

  .compact .graph-instructions p {
    font-size: 10px;
  }

  @media (max-width: 768px) {
    .stats {
      font-size: 12px;
    }

    .graph-legend {
      gap: 10px;
    }

    .delegation-graph {
      width: 100%;
      height: 400px;
    }
  }
</style>
