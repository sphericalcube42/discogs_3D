import { expandAll } from "./graphActions.js";
import * as yt from "./youtubePlayer.js";
import { resolveEntity } from "./api.js";
import { getCy } from "./graph.js";
import {select_neighborhood} from "./ui.js";


export async function openSidePanel(node, extraData) {
  const panel = document.getElementById("side-panel");
  const title = document.getElementById("panel-title");
  const content = document.getElementById("panel-content");

  panel.classList.remove("hidden");
  const data = node.data();
  

  // Title = name only
  title.textContent = data.name;

  // Basic content
  let html = `
    <div class="info-row">
      <span class="label">Type:</span>
      <span class="value">${data.type}</span>
    </div>

    <div class="info-row">
      <span class="label">ID:</span>
      <span class="value">${data.rawId}</span>
    </div>

    <div class="info-row">
      <span class="label">Releases:</span>
      <span class="value">${data.total_release_count ?? 0}</span>
    </div>
  `;
  //add profile
  if (data.profile) {
    html += `
      <div class="profile-box">
        ${data.profile}
      </div>
    `;
  }
  html += `
  <div class="yt-mini-player">
    
    <!-- current track -->
    <div class="yt-now">
      <div class="yt-title-wrapper"
        <div id="yt-title">No track</div>
      </div>
    </div>

    <!-- progress -->
    <input id="yt-seek" type="range" min="0" max="100" value="0">

    <!-- controls -->
    <div class="yt-bar">
      <div class="yt-controls">
        <button id="yt-prev">⏮</button>
        <button id="yt-toggle">▶</button>
        <button id="yt-next">⏭</button>
      </div>
      <div class="yt-time">
          <span id="yt-current">0:00</span> /
          <span id="yt-duration">0:00</span>
      </div>
    </div>
    <!-- playlist -->
    <div id="yt-playlist" class="yt-playlist"></div>

  </div>
`;
  

  const tableData =
    extraData?.labels ||
    extraData?.artists ||
    [];

  if (tableData.length) {
    html += `
      <div class="table-container">
        <table class="label-table">
          <thead>
            <tr>
              <th>${data.type === "artist" ? "Label" : "Artist"}</th>
              <th>Releases</th>
            </tr>
          </thead>
          <tbody>
            ${tableData.map(item => `
              <tr>
                <td 
                  class="table-node-link"
                  data-id="${item.id}"
                  data-type="${data.type === "artist" ? "label" : "artist"}"
                >
                  ${item.name}
                </td>
                <td>${item.release_count}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }
  
  //add Button to expand ALL childs
  html += `
  <button id="expand-all-btn" style="margin-top:10px;">
    Expand All ${data.type === "artist" ? "Labels" : "Artists"}
  </button>
  `;
  
  content.innerHTML = html;
  


  //YT-Player Logic
  
  //Fetch related YT Videos
  try {

    const vid = await resolveEntity(node.data().type, node.data().rawId);

    const tracks = (vid.videos || [])
      .map(v => ({
        id: yt.extractVideoId(v.uri),
        title: v.title
      }))
      .filter(t => t.id);

    if (tracks.length) {
      yt.setPlaylist(tracks);
      yt.initYTPlayer(tracks[0].id);
      yt.renderPlaylist();
    }

    document.getElementById("yt-toggle").onclick = yt.setupToggle;
    document.getElementById("yt-next").onclick = yt.nextTrack;
    document.getElementById("yt-prev").onclick = yt.prevTrack;

    yt.setupSeekBar();
    yt.startProgressUpdates();

} catch (err) {
  console.error("❌ PANEL ERROR:", err);
}
  //select entry in table

  const cy = getCy();
  document.querySelectorAll(".table-node-link").forEach(el => {
    el.onclick = () => {
      const id = el.dataset.id;
      const type = el.dataset.type;

      const nodeId = `${type}_${id}`;
      const targetNode = cy.getElementById(nodeId);

      if (!targetNode || targetNode.empty()) {
        console.warn("Node not found in graph:", nodeId);
        return;
      }

      // simulate normal selection behavior
      cy.$(":selected").unselect();
      targetNode.select();

      //center on selected node
      cy.animate({
        center: { eles: targetNode },
        zoom: 1.2,
        duration: 300
      });

      // reuse your existing logic
      select_neighborhood(targetNode);
      openSidePanel(targetNode, targetNode.data("extraData"));
    };
  });

  //Button logic
  const btn = document.getElementById("expand-all-btn");

  btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = "Expanding...";

    try {
      await expandAll(node);

      btn.textContent = "Expanded";
    } catch (err) {
      console.error(err);
      btn.disabled = false;
      btn.textContent = "Expand All";
    }
  };

}