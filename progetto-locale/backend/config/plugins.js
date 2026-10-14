module.exports = ({ env }) => ({
  upload: {
    config: {
      provider: 'local',
      sizeLimit: 100 * 1024 * 1024,
      breakpoints: {
        thumbnail: 240,
        small: 480,
        medium: 960,
        large: 1920,
      },
      formats: ['webp'],
      sharp: {
        quality: 82,
        progressive: true,
        withoutEnlargement: true,
      },
    },
  },
});
