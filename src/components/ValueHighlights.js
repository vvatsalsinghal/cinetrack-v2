const highlights = [
  {
    number: "01",
    title: "Find your next watch",
    description:
      "Explore stories that fit the moment, instead of scrolling without a plan.",
  },
  {
    number: "02",
    title: "Keep your cinema together",
    description:
      "One home for the films and series you want to watch and the ones you have.",
  },
  {
    number: "03",
    title: "Make each watch count",
    description:
      "Build a personal record of the stories that stay with you.",
  },
];

export default function ValueHighlights() {
  return (
    <div className="grid gap-8 border-t border-line pt-7 md:grid-cols-3 md:gap-10">
      {highlights.map((highlight) => (
        <article key={highlight.number} className="max-w-sm">
          <p className="mb-5 text-xs font-medium tracking-[0.16em] text-accent">
            {highlight.number}
          </p>
          <h3 className="mb-3 text-lg font-medium">{highlight.title}</h3>
          <p className="text-sm leading-7 text-muted">
            {highlight.description}
          </p>
        </article>
      ))}
    </div>
  );
}
