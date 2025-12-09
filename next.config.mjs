/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Ignorar erros de lint durante o build (warnings não bloqueiam)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // ⚠️ Permite que o build seja concluído mesmo com erros de tipo
    // Remova isso em produção!
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
