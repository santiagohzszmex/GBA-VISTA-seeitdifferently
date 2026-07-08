/**
 * Motor de carga centralizado para Cloudinary (Ecosistema VISTA)
 * Permite subir imágenes, portadas y documentos PDF de forma segura desde el frontend.
 */
export const uploadToCloudinary = async (file, folderPath = '') => {
  if (!file) {
    console.error("No se proporcionó ningún archivo para subir.");
    return null;
  }

  // Extraemos las variables de entorno configuradas en el .env
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    console.error("Faltan las variables de entorno de Cloudinary (VITE_CLOUDINARY_CLOUD_NAME o VITE_CLOUDINARY_UPLOAD_PRESET).");
    return null;
  }

  // Preparamos el contenedor de datos para la petición HTTP
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  if (folderPath) formData.append('folder', folderPath);

  try {
    // Disparamos la petición directa a la API de Cloudinary
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Cloudinary rechazó la subida:", errorData);
      return null;
    }

    const data = await response.json();
    
    // Retornamos la URL segura (HTTPS) lista para guardarse en Supabase
    return data.secure_url; 
  } catch (error) {
    console.error("Fallo crítico en el cliente de Cloudinary:", error);
    return null;
  }
};
