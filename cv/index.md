---
layout: default
title: CV
permalink: /cv/
body_class: cv-page
---

{% assign cv_pdf = '/assets/cv/CV.pdf' | relative_url %}

<div class="cv-toolbar">
  <div class="cv-toolbar__left">
    <div class="cv-toolbar__title">Curriculum Vitae (PDF)</div>
    <div class="cv-toolbar__hint">
      If the preview doesn’t load, use the download button.
    </div>
  </div>

  <a class="btn" href="{{ cv_pdf }}" target="_blank" rel="noreferrer">Download PDF</a>
</div>

<iframe
  class="cv-frame"
  src="{{ cv_pdf }}"
  title="CV PDF Preview"
  loading="lazy">
</iframe>
