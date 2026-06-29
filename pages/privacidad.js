import Head from 'next/head';

const C = {
  bg: '#0d0d0f', card: '#141418', border: '#2e2e38',
  hi: '#f0ece4', body: '#c8c0b4', mid: '#8a8278', gold: '#d4a853',
};

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: C.hi, margin: '0 0 10px' }}>{title}</h2>
      <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 15, lineHeight: 1.8, color: C.body }}>{children}</div>
    </section>
  );
}

export default function Privacidad() {
  const updated = '29 de junio de 2026';
  return (
    <>
      <Head>
        <title>Política de Privacidad — MERIDIAN</title>
        <meta name="robots" content="index,follow" />
      </Head>
      <div style={{ background: '#08050a', minHeight: '100vh', padding: '0 0 60px' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '40px 22px' }}>
          <a href="/" style={{ fontFamily: "'Libre Franklin', sans-serif", fontSize: 12, color: C.gold, textDecoration: 'none', letterSpacing: '.08em' }}>← MERIDIAN</a>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, fontWeight: 800, color: C.hi, margin: '18px 0 6px' }}>Política de Privacidad</h1>
          <p style={{ fontFamily: "'Libre Franklin', sans-serif", fontSize: 12, color: C.mid, marginBottom: 32 }}>Última actualización: {updated}</p>

          <Section title="1. Responsable del tratamiento">
            Esta web (“Meridian”) es una publicación independiente de inteligencia de mercados de capital.
            Para cualquier cuestión relativa a privacidad o protección de datos puedes contactar en{' '}
            <a href="mailto:arosmuno@gmail.com" style={{ color: C.gold }}>arosmuno@gmail.com</a>.
          </Section>

          <Section title="2. Qué datos tratamos">
            Meridian no requiere registro ni recoge datos personales identificativos de forma directa
            (no hay cuentas de usuario ni formularios). Como cualquier sitio web, el proveedor de alojamiento
            puede registrar datos técnicos básicos (dirección IP, tipo de navegador, fecha y hora) en los
            registros del servidor con fines de seguridad y funcionamiento.
          </Section>

          <Section title="3. Cookies">
            Utilizamos cookies <strong>esenciales</strong> necesarias para el funcionamiento del sitio.
            Si das tu consentimiento, podremos usar cookies de <strong>publicidad</strong> a través de
            Google AdSense para mostrar anuncios y sostener el proyecto. Puedes aceptar o rechazar las
            cookies no esenciales mediante el banner de consentimiento, y cambiar tu elección borrando los
            datos del sitio en tu navegador.
          </Section>

          <Section title="4. Terceros">
            Empleamos los siguientes proveedores, que pueden tratar datos técnicos conforme a sus propias
            políticas: <strong>Vercel</strong> (alojamiento), <strong>Supabase</strong> (base de datos del
            contenido) y, cuando esté activo, <strong>Google AdSense</strong> (publicidad). Google puede
            utilizar cookies para personalizar anuncios; puedes gestionar tus preferencias en
            {' '}<a href="https://adssettings.google.com" style={{ color: C.gold }}>adssettings.google.com</a>.
          </Section>

          <Section title="5. Base legal y tus derechos">
            La base legal es tu consentimiento (cookies no esenciales) y el interés legítimo en el
            funcionamiento y seguridad del sitio. Tienes derecho a acceder, rectificar, suprimir, limitar u
            oponerte al tratamiento de tus datos, así como a la portabilidad y a retirar el consentimiento en
            cualquier momento. Para ejercerlos, escribe a{' '}
            <a href="mailto:arosmuno@gmail.com" style={{ color: C.gold }}>arosmuno@gmail.com</a>. También
            puedes reclamar ante la autoridad de control competente (en España, la AEPD).
          </Section>

          <Section title="6. Cambios en esta política">
            Podemos actualizar esta política para reflejar cambios legales o del servicio. Publicaremos la
            versión vigente en esta misma página con su fecha de actualización.
          </Section>

          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 36, paddingTop: 16 }}>
            <a href="/" style={{ fontFamily: "'Libre Franklin', sans-serif", fontSize: 12, color: C.mid, textDecoration: 'none' }}>← Volver a Meridian</a>
          </div>
        </div>
      </div>
    </>
  );
}
