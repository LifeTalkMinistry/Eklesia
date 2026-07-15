import { useEffect, useState } from 'react';

export default function ChurchAnnouncementBillboard({ announcements, onViewDetails, onAddToCalendar }) {
  const featured = announcements.filter((announcement) => announcement.featured);
  const slides = featured.length ? featured : announcements.slice(0, 1);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (activeIndex >= slides.length) setActiveIndex(0);
  }, [activeIndex, slides.length]);

  if (!slides.length) {
    return (
      <section className="church-home-billboard church-home-billboard-empty" aria-labelledby="church-home-featured-heading">
        <p className="dashboard-eyebrow">Featured announcement</p>
        <h2 id="church-home-featured-heading">Nothing featured yet</h2>
        <p>Church administrators can feature an announcement from Admin Tools.</p>
      </section>
    );
  }

  const announcement = slides[activeIndex];
  const backgroundStyle = announcement.imageUrl
    ? { backgroundImage: `linear-gradient(90deg, rgba(4, 13, 8, .96), rgba(4, 13, 8, .66)), url("${announcement.imageUrl}")` }
    : undefined;

  function move(direction) {
    setActiveIndex((current) => (current + direction + slides.length) % slides.length);
  }

  return (
    <section className="church-home-billboard" style={backgroundStyle} aria-roledescription="carousel" aria-label="Featured church announcements">
      <div className="church-home-billboard-topline">
        <span>{announcement.category || 'Church announcement'}</span>
        <span>{activeIndex + 1} of {slides.length}</span>
      </div>

      <div className="church-home-billboard-copy" aria-live="polite">
        <p className="dashboard-eyebrow">Featured announcement</p>
        <h2 id="church-home-featured-heading">{announcement.title}</h2>
        {(announcement.eventDate || announcement.time || announcement.location) ? (
          <p className="church-home-billboard-schedule">
            {[announcement.eventDate, announcement.time, announcement.location].filter(Boolean).join(' · ')}
          </p>
        ) : null}
        <p>{announcement.description}</p>
      </div>

      <div className="church-home-billboard-actions">
        <button className="church-home-primary-action" type="button" onClick={() => onViewDetails(announcement)}>
          {announcement.actionLabel || 'View details'}
        </button>
        {announcement.eventDate ? (
          <button className="church-home-secondary-action" type="button" onClick={() => onAddToCalendar(announcement)}>
            Add to calendar
          </button>
        ) : null}
      </div>

      <div className="church-home-billboard-controls">
        <div className="church-home-billboard-arrows">
          <button type="button" onClick={() => move(-1)} aria-label="Show previous featured announcement" disabled={slides.length < 2}>←</button>
          <button type="button" onClick={() => move(1)} aria-label="Show next featured announcement" disabled={slides.length < 2}>→</button>
        </div>
        <div className="church-home-billboard-dots" aria-label="Choose featured announcement">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              className={index === activeIndex ? 'is-active' : ''}
              onClick={() => setActiveIndex(index)}
              aria-label={`Show featured announcement ${index + 1}: ${slide.title}`}
              aria-current={index === activeIndex ? 'true' : undefined}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
