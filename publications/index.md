---
layout: default
title: Publications
permalink: /publications/
---

<!-- TOP: Citations chart -->
<section class="panel">
  <div class="panel__hd">
    <h2 class="panel__title">Citations</h2>
    <p class="panel__sub">Citations per year (auto from <code>_data/citations.yml</code>)</p>
  </div>

  <div class="panel__bd">
    {% assign cits = site.data.citations | sort: "year" %}

    {% if cits and cits.size > 0 %}
      {% assign maxc = 0 %}
      {% assign total = 0 %}
      {% for r in cits %}
        {% if r.count > maxc %}{% assign maxc = r.count %}{% endif %}
        {% assign total = total | plus: r.count %}
      {% endfor %}

      <div class="scholar-chart">
        <div class="scholar-chart__top">
          <div class="scholar-chart__title">Citations per year</div>
          <div class="scholar-chart__meta">Total (shown years): {{ total }}</div>
        </div>

        <div class="scholar-bars">
          {% for r in cits %}
            {% assign pct = 0 %}
            {% if maxc > 0 %}
              {% assign pct = r.count | times: 100 | divided_by: maxc %}
            {% endif %}
            {% assign hpx = pct | times: 170 | divided_by: 100 %}

            <div class="scholar-bar">
              <div class="scholar-bar__count">{{ r.count }}</div>
              <div class="scholar-bar__col"
                   style="--h: {{ hpx }}px;"
                   data-tip="{{ r.year }}: {{ r.count }}">
              </div>
              <div class="scholar-bar__year">{{ r.year }}</div>
            </div>
          {% endfor %}
        </div>
      </div>

    {% else %}
      <p class="muted">
        No citation data yet. Make sure your workflow creates <code>_data/citations.yml</code>.
      </p>
    {% endif %}

    {% if site.social.google_scholar %}
      <div style="margin-top:12px;">
        {% assign gs = site.social.google_scholar %}
        {% if gs contains "http" %}
          <a class="btn" href="{{ gs }}" target="_blank" rel="noreferrer">View Scholar Profile</a>
        {% else %}
          <a class="btn" href="https://scholar.google.com/citations?user={{ gs }}" target="_blank" rel="noreferrer">View Scholar Profile</a>
        {% endif %}
      </div>
    {% endif %}
  </div>
</section>

<!-- BELOW: Publications list (scrollable) -->
<section class="panel" style="margin-top:14px;">
  <div class="panel__hd">
    <h2 class="panel__title">Publications</h2>
    <p class="panel__sub">Newest first · scrollable list</p>
  </div>

  {% if site.data.publications == nil or site.data.publications.size == 0 %}
    <div class="panel__bd">
      ⚠️ <b>No publications found.</b><br/>
      Please ensure <code>_data/publications.yml</code> exists and contains at least one entry.
    </div>
  {% else %}

    {% assign pubs = site.data.publications | where_exp: "p", "p.year != nil" | sort: "year" | reverse %}
    {% assign years = pubs | map: "year" | uniq %}

    <div class="pubs-scroll">
      {% for y in years %}
        <h3 style="margin:14px 0 6px;">{{ y }}</h3>

        {% assign by_year = pubs | where: "year", y %}
        {% for p in by_year %}
          <div class="pub-card">
            <div class="pub-title">{{ p.title }}</div>

            {% if p.authors %}
              <p class="pub-meta"><b>Authors:</b> {{ p.authors }}</p>
            {% endif %}

            {% if p.venue %}
              <p class="pub-meta"><b>Venue:</b> {{ p.venue }}{% if p.type %} · {{ p.type }}{% endif %}</p>
            {% endif %}

            <div class="pub-links">
              {% if p.pdf and p.pdf != "" %}
                <a class="pub-btn" href="{{ p.pdf }}" target="_blank" rel="noreferrer">PDF</a>
              {% endif %}
              {% if p.doi and p.doi != "" %}
                <a class="pub-btn" href="{{ p.doi }}" target="_blank" rel="noreferrer">DOI</a>
              {% endif %}
              {% if p.code and p.code != "" %}
                <a class="pub-btn" href="{{ p.code }}" target="_blank" rel="noreferrer">Code</a>
              {% endif %}
            </div>
          </div>
        {% endfor %}
      {% endfor %}
    </div>

  {% endif %}
</section>
