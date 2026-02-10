---
layout: default
title: Publications
permalink: /publications/
---

{% if site.data.publications == nil or site.data.publications.size == 0 %}
⚠️ **No publications found.**

Please ensure `_data/publications.yml` exists and contains at least one entry.
{% else %}

{% assign pubs = site.data.publications | where_exp: "p", "p.year != nil" %}
{% assign pubs = pubs | sort: "year" | reverse %}
{% assign years = pubs | map: "year" | uniq %}

{% for y in years %}
## {{ y }}

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
      <a class="pub-btn" href="{{ p.pdf }}" target="_blank">PDF</a>
    {% endif %}
    {% if p.doi and p.doi != "" %}
      <a class="pub-btn" href="{{ p.doi }}" target="_blank">DOI</a>
    {% endif %}
    {% if p.code and p.code != "" %}
      <a class="pub-btn" href="{{ p.code }}" target="_blank">Code</a>
    {% endif %}
  </div>
</div>
{% endfor %}
{% endfor %}

{% endif %}
