export default function SectionHeading({ id, eyebrow, title }) {
  return (
    <div>
      <p className="eyebrow mb-4">
        <span aria-hidden="true" />
        {eyebrow}
      </p>
      <h2
        id={id}
        className="text-3xl font-medium tracking-tight sm:text-4xl"
      >
        {title}
      </h2>
    </div>
  );
}
