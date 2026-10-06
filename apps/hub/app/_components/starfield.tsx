// Céu estrelado decorativo (só CSS): estrelas em três camadas que cintilam, nebulosas e estrelas cadentes.
export function Starfield() {
  return (
    <div className="hub-sky" aria-hidden="true">
      <div className="hub-sky__nebula hub-sky__nebula--violet" />
      <div className="hub-sky__nebula hub-sky__nebula--teal" />
      <div className="hub-sky__stars hub-sky__stars--a" />
      <div className="hub-sky__stars hub-sky__stars--b" />
      <div className="hub-sky__stars hub-sky__stars--c" />
      <div className="hub-sky__comet" />
      <div className="hub-sky__comet hub-sky__comet--late" />
    </div>
  );
}
