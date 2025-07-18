export default function Contact() {
  return (
    <section className="py-16 text-center bg-white">
      <h2 className="text-3xl font-bold text-purple-700 mb-4">Contact</h2>
      <p className="text-gray-700">
        You can reach me via{" "}
        <a
          href="https://www.linkedin.com/in/tejas-raut/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          LinkedIn
        </a>
        ,{" "}
        <a
          href="https://github.com/rautte/rautte.github.io"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          GitHub
        </a>
        , or{" "}
        <a
          href="mailto:tjsrt@outlook.com"
          className="text-blue-600 hover:underline"
        >
          Email
        </a>
        .
      </p>
    </section>
  );
}