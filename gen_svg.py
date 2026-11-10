def mountain(x, y, w, h, c_left, c_right, c_line, c_highlight):
    half_w = w / 2
    return f"""
    <!-- Mountain at {x} -->
    <path d="M{x - half_w} {y} L{x} {y - h} L{x} {y} Z" fill="{c_left}"/>
    <path d="M{x} {y - h} L{x + half_w} {y} L{x} {y} Z" fill="{c_right}"/>
    <!-- Highlights -->
    <path d="M{x - half_w} {y} L{x} {y - h} L{x + half_w} {y}" fill="none" stroke="{c_line}" stroke-opacity="0.15" stroke-width="1.5"/>
    <path d="M{x} {y - h} L{x} {y}" fill="none" stroke="{c_highlight}" stroke-opacity="0.2" stroke-width="1.5"/>
"""

svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-labelledby="title description">
  <title id="title">StockRidge premium brand mark</title>
  <desc id="description">A premium composition of distinct emerald mountains rising behind a solid black structure proportional to the Kaaba.</desc>
  <defs>
    <linearGradient id="backdrop" x1="72" y1="40" x2="440" y2="480" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0d2d20"/>
      <stop offset="0.55" stop-color="#071d14"/>
      <stop offset="1" stop-color="#04120d"/>
    </linearGradient>

    <!-- Mountain facets -->
    <linearGradient id="mount-left-left" x1="60" y1="260" x2="150" y2="260" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#4ae390"/>
      <stop offset="1" stop-color="#24c06b"/>
    </linearGradient>
    <linearGradient id="mount-left-right" x1="150" y1="260" x2="240" y2="260" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#168b47"/>
      <stop offset="1" stop-color="#0e6030"/>
    </linearGradient>

    <linearGradient id="mount-mid-left" x1="120" y1="200" x2="256" y2="200" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#2ecc71"/>
      <stop offset="1" stop-color="#27ae60"/>
    </linearGradient>
    <linearGradient id="mount-mid-right" x1="256" y1="200" x2="392" y2="200" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#147c3f"/>
      <stop offset="1" stop-color="#0c5128"/>
    </linearGradient>

    <linearGradient id="mount-right-left" x1="270" y1="265" x2="360" y2="265" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#4ae390"/>
      <stop offset="1" stop-color="#24c06b"/>
    </linearGradient>
    <linearGradient id="mount-right-right" x1="360" y1="265" x2="450" y2="265" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#168b47"/>
      <stop offset="1" stop-color="#0e6030"/>
    </linearGradient>

    <linearGradient id="kaaba-front" x1="169" y1="176" x2="343" y2="376" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#222222"/>
      <stop offset="0.5" stop-color="#111111"/>
      <stop offset="1" stop-color="#000000"/>
    </linearGradient>
    
    <linearGradient id="gold-band" x1="169" y1="220" x2="343" y2="220" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#f5d76e"/>
      <stop offset="0.5" stop-color="#f1c40f"/>
      <stop offset="1" stop-color="#d4ac0d"/>
    </linearGradient>
  </defs>

  <rect x="16" y="16" width="480" height="480" rx="104" fill="url(#backdrop)"/>
  <rect x="24" y="24" width="464" height="464" rx="96" fill="none" stroke="#b8e5ca" stroke-opacity="0.12" stroke-width="2"/>

  <g id="ridges" stroke-linejoin="round">
{mountain(256, 376, 280, 260, 'url(#mount-mid-left)', 'url(#mount-mid-right)', '#ffffff', '#ffffff')}
{mountain(150, 376, 180, 180, 'url(#mount-left-left)', 'url(#mount-left-right)', '#ffffff', '#ffffff')}
{mountain(360, 376, 180, 160, 'url(#mount-right-left)', 'url(#mount-right-right)', '#ffffff', '#ffffff')}
  </g>

  <!-- Kaaba Cube -->
  <g id="kaaba-cube">
    <!-- Main Black Body -->
    <rect x="169" y="176" width="174" height="200" fill="url(#kaaba-front)" stroke="#444" stroke-opacity="0.8" stroke-width="1.5"/>
    
    <!-- Subtle Gold Band (Hizam) -->
    <rect x="169.75" y="214" width="172.5" height="12" fill="url(#gold-band)"/>
    <path d="M169.75 226 L342.25 226" fill="none" stroke="#c29a0c" stroke-width="1"/>
    <path d="M169.75 214 L342.25 214" fill="none" stroke="#ffeb99" stroke-width="1"/>
    
    <!-- Crisp Top Edge Highlight -->
    <path d="M169.75 176.75 L342.25 176.75" fill="none" stroke="#555" stroke-opacity="0.9" stroke-width="1.5"/>
  </g>
</svg>
"""

with open("new-logo.svg", "w") as f:
    f.write(svg)
