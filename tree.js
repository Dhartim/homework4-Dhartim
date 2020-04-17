//  reference link : https://observablehq.com/@d3/tidy-tree?collection=@d3/d3-hierarchy

let drawTreeChart = function(data) {
  //convert csv to hierarchy
  console.log("Original Dataset = ", data);
  nodes = new Set(data.map(row => row.NodeID));
  console.log(nodes);
  let processed = data.map(function(row) {
    // get name of parent node
    let parent = row.NodeID.substring(0, row.NodeID.lastIndexOf("."));
    return {
      name: row.NodeID, unique: row.UniqueID,
      // if there isn't a parent node set the paren to java directly
      size: row['Incident Number'],
      parent: nodes.has(parent) || row.name === "root"
        ? parent
        : "root"
    };
  });
  //explicitly changed last element to get proper format of data
  processed[processed.length - 1].parent = null;
  console.log("Processed Data = ", processed);
  let tree = d3.stratify().id(function(row) {
    return row.name;
  }).parentId(function(row) {
    return row.parent;
  })(processed);

  console.log("tree = ", tree);

  //draw tree
  let width = 900;
  let height = 600;
  let pad = 15;
  let diameter = 500;
  //create svg
  //let svg = d3.select("#tree").style("width", width).style("height", height);



  //create svg for cartesian cordinates
  let svg = d3.select("#tree")
  .attr("width", width)
  .attr("height", diameter);

  //sort it
  tree.sort(function(a, b) {
    return b.height - a.height || b.count - a.count;
  });

  //layout
  // let layout = d3.cluster().size([
  //   width - 2 * pad,
  //   height - 2 * pad
  // ]);
  //for cartesian
  let layout = d3.cluster().size([2 * Math.PI, (diameter / 2) - pad]);
  layout(tree);

  //convert to cartesian
  tree.each(function(node) {
    node.theta = node.x;
    node.radial = node.y;

    var point = toCartesian(node.radial, node.theta);
    node.x = point.x;
    node.y = point.y;
  });

  //plot layer
  // let plot = svg.append("g").attr("id", "plot").attr("transform", translate(pad, pad));

  //plot for cartesian and zoom 
  let plot = svg
  .call(d3.zoom()
  .on("zoom", function () {
       plot.attr("transform", d3.event.transform)
    }))
  .append("g")
  .attr("id", "plot")
  .attr("transform", translate(width / 2, diameter / 2))


  ;

  window.color = d3.scaleSequential([
    tree.height, 0
  ], d3.interpolateViridis);
  drawLinks(plot.append("g"), tree.links());
  drawNodes(plot.append("g"), tree.descendants(), true);
  //interactivity highlight on mouse over and out
  plot.selectAll("circle.node").on("mouseover.tree", function(d) {
    plot.selectAll("circle.node").data([d], node => node.data.name).raise().classed('selected', true);
  }).on("mouseout.tree", function(d) {
    plot.selectAll("circle.node").data([d], node => node.data.name).lower().classed('selected', false);
  });

  return svg.node();
}

function drawLinks(g, links) {
  let line = d3.line().curve(d3.curveLinear).x(d => d.x).y(d => d.y);
  let generator = function(node) {
    return line([node.source, node.target]);
  };

  let path = g.selectAll('path').data(links).enter().append('path').attr('d', generator).attr('class', 'link');
}

function drawNodes(g, nodes, raise) {
  let r = 5;
  let circles = g.selectAll('circle').data(nodes, node => node.data.name).enter().append("circle").attr(
    "r", d => d.r
    ? d.r
    : r).attr("cx", d => d.x).attr("cy", d => d.y).attr("id", d => d.data.unique).attr("class", "node").style("fill", d => color(d.depth));

  setupEvents(g, circles, raise);
}

function setupEvents(g, selection, raise) {
  selection.on('mouseover.highlight', function(d) {
    // https://github.com/d3/d3-hierarchy#node_path
    // returns path from d3.select(this) node to selection.data()[0] root node
    let path = d3.select(this).datum().path(selection.data()[0]);

    // select all of the nodes on the shortest path
    let update = selection.data(path, node => node.data.name);

    // highlight the selected nodes
    update.classed('selected', true); //raise();

    if (raise) {
      update.raise();
    }
  });

  selection.on('mouseout.highlight', function(d) {
    let path = d3.select(this).datum().path(selection.data()[0]);
    let update = selection.data(path, node => node.data.name);
    update.classed('selected', false);
  });

  // show tooltip text on mouseover (hover)
  selection.on('mouseover.tooltip', function(d) {
    showTooltip(g, d3.select(this));
  });

  // remove tooltip text on mouseout
  selection.on('mouseout.tooltip', function(d) {
    g.select("#tooltip").remove();
  });

  //brushing interactivity
  // selection.on("mouseover.brush1", function(d) {
  //   selection.filter(e => (d.height !== e.height)).lower().transition();
  // });
  // selection.on("mouseout.brush1", function(d) {
  //   selection.transition().style("fill", d => color(d.height));
  // });

}

function showTooltip(g, node) {
  let gbox = g.node().getBBox(); // get bounding box of group BEFORE adding text
  let nbox = node.node().getBBox(); // get bounding box of node

  // calculate shift amount
  let dx = nbox.width / 2;
  let dy = nbox.height / 2;

  // retrieve node attributes (calculate middle point)
  let x = nbox.x + dx;
  let y = nbox.y + dy;

  // get data for node
  let datum = node.datum();

  // remove "java.base." from the node name
  let name = datum.data.name.substring(datum.data.name.lastIndexOf(".") + 1);

  // use node name and total size as tooltip text
  let text = `${name} (${datum.data.size})`;

  // create tooltip
  let tooltip = g.append('text').text(text).attr('x', x).attr('y', y).attr('dy', -dy - 4). // shift upward above circle
  attr('text-anchor', 'middle'). // anchor in the middle
  attr('id', 'tooltip');

  // it is possible the tooltip will fall off the edge of the
  // plot area. we can detect when this happens, and set the
  // text anchor appropriately

  // get bounding box for the text
  let tbox = tooltip.node().getBBox();

  // if text will fall off left side, anchor at start
  if (tbox.x < gbox.x) {
    tooltip.attr('text-anchor', 'start');
    tooltip.attr('dx', -dx)// if text will fall off right side, anchor at end; // nudge text over from center
  } else if ((tbox.x + tbox.width) > (gbox.x + gbox.width)) {
    tooltip.attr('text-anchor', 'end');
    tooltip.attr('dx', dx);
  }

  // if text will fall off top side, place below circle instead
  if (tbox.y < gbox.y) {
    tooltip.attr('dy', dy + tbox.height);
  }
}

function translate(x, y) {
  return 'translate(' + String(x) + ',' + String(y) + ')';
}

//to convert toCartesian
function toCartesian(r, theta) {
  return {
    x: r * Math.cos(theta),
    y: r * Math.sin(theta)
  };
}


// https://observablehq.com/@notanaccent/transitioning-hierarchical-layouts
