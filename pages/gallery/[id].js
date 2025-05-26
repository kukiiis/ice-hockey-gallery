// pages/gallery/[id].js
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';
import styles from '../../styles/IndividualGallery.module.css';
import { useCart } from '@/context/CartContext'; // Import useCart

// --- CONFIGURATION ---
const STORAGE_BUCKET_NAME = 'photos';
const IMAGE_PATH_COLUMN = 'storage_path';
const PHOTO_NAME_COLUMN = 'filename'; // Column for the photo's descriptive name

// --- FIXED PRICES ---
const DIGITAL_PHOTO_PRICE = 4; // EUR
const PRINTED_PHOTO_PRICE = 8; // EUR
// --- END FIXED PRICES ---

// Function to remove any file extension
const removeFileExtension = (filename) => {
  if (!filename) return '';
  return filename.replace(/\.[^/.]+$/, '');
};

// Function to fetch watermark URL
const fetchWatermarkUrl = async () => {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'watermark_path')
      .single();
    
    if (error || !data?.value) return null;
    
    const { data: publicUrlData } = supabase
      .storage
      .from('watermarks')
      .getPublicUrl(data.value);
    
    return publicUrlData?.publicUrl || null;
  } catch (error) {
    console.error('Error fetching watermark:', error);
    return null;
  }
};

export default function IndividualGalleryPage() {
  const router = useRouter();
  const { id: galleryId } = router.query;
  const { addToCart } = useCart(); // Get addToCart from context

  const [gallery, setGallery] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [watermarkUrl, setWatermarkUrl] = useState(null);

  const [selectedImage, setSelectedImage] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    if (!galleryId) {
      setLoading(false);
      setError("Gallery ID is missing.");
      return;
    }

    async function fetchGalleryDetails() {
      setLoading(true);
      setError(null);
      try {
        // Fetch watermark
        const watermark = await fetchWatermarkUrl();
        setWatermarkUrl(watermark);

        const { data: galleryData, error: galleryError } = await supabase
          .from('galleries')
          .select('id, name, created_at')
          .eq('id', galleryId)
          .single();
        if (galleryError) throw galleryError;
        if (!galleryData) throw new Error(`Gallery with ID ${galleryId} not found.`);
        setGallery(galleryData);

        // Select necessary fields. We are not fetching 'price' from DB for these fixed-price buttons.
        let photoSelectFields = `id, ${IMAGE_PATH_COLUMN}`;
        if (PHOTO_NAME_COLUMN) photoSelectFields += `, ${PHOTO_NAME_COLUMN}`;
        // If you had a 'price' column in your DB and wanted to use it for other purposes,
        // you could still select it here, but the buttons below will use the fixed prices.

        const { data: photosData, error: photosError } = await supabase
          .from('photos')
          .select(photoSelectFields)
          .eq('gallery_id', galleryId)
          .order('created_at', { ascending: false });
        if (photosError) throw photosError;

        const processedPhotos = (photosData || []).map(photo => {
          const imagePath = photo[IMAGE_PATH_COLUMN];
          let imageUrl = null;
          if (imagePath) {
            const { data: urlData } = supabase.storage.from(STORAGE_BUCKET_NAME).getPublicUrl(imagePath);
            imageUrl = urlData ? urlData.publicUrl : null;
          }
          return {
            ...photo,
            image_url: imageUrl,
            displayName: (PHOTO_NAME_COLUMN && photo[PHOTO_NAME_COLUMN]) ? photo[PHOTO_NAME_COLUMN] : null,
            // No need to process 'price' from DB for these fixed-price buttons
          };
        });
        setPhotos(processedPhotos);
      } catch (err) {
        console.error('Error fetching gallery details:', err);
        let errMsg = err.message || 'Failed to load gallery details.';
        if (err.message && err.message.toLowerCase().includes("column") && err.message.toLowerCase().includes("does not exist")) {
          errMsg = `Database schema error. A required column might be missing or misnamed (e.g., '${IMAGE_PATH_COLUMN}', '${PHOTO_NAME_COLUMN}'). Original: ${err.message}`;
        }
        setError(errMsg);
      } finally {
        setLoading(false);
      }
    }
    fetchGalleryDetails();
  }, [router.isReady, galleryId]);

  const openModal = (imageUrl) => {
    if (!imageUrl) return;
    setSelectedImage(imageUrl);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedImage(null);
  };

  const handleAddToCart = (e, photo, type, price, options = {}) => {
    e.stopPropagation(); // Prevent modal from opening when clicking button
    addToCart(photo, type, price, options);
  };

  useEffect(() => {
    const handleEsc = (event) => event.key === 'Escape' && closeModal();
    if (isModalOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isModalOpen]);

  if (loading) return <div className={`${styles.pageContainer} ${styles.loadingSpinner}`}>Loading gallery...</div>;
  if (error) return <div className={`${styles.pageContainer} ${styles.errorMessage}`}>Error: {error}</div>;
  if (!gallery) return <div className={`${styles.pageContainer} ${styles.errorMessage}`}>Gallery not found.</div>;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.galleryHeader}>
        <h1 className={styles.galleryTitle}>{gallery.name}</h1>
        <Link href="/galleries" legacyBehavior><a className={styles.backLink}>← Back to Galleries</a></Link>
      </div>

      {photos.length === 0 ? (
        <p className={styles.errorMessage}>No photos in this gallery yet.</p>
      ) : (
        <div className={styles.photoGrid}>
          {photos.map((photo) => (
            <div key={photo.id} className={styles.photoCard}>
              <div 
                className={styles.imageContainer}
                onClick={() => openModal(photo.image_url)}
                role="button"
                tabIndex={0}
                onKeyPress={(e) => e.key === 'Enter' && openModal(photo.image_url)}
                aria-label={`View ${photo.displayName || 'photo'} enlarged`}
              >
                {photo.image_url ? (
                  <div className={styles.photoWrapper}>
                    <img
                      src={photo.image_url}
                      alt={photo.displayName || `Photo from ${gallery.name}`}
                      className={styles.photoImage}
                      loading="lazy"
                    />
                    {/* Watermark overlay */}
                    {watermarkUrl && (
                      <div className={styles.watermarkOverlay}>
                        <img 
                          src={watermarkUrl} 
                          alt="Watermark" 
                          className={styles.watermark}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={styles.placeholderImage}>Image not available</div>
                )}
              </div>
              
              <div className={styles.photoInfoAndActions}>
                {photo.displayName && (
                  <p className={styles.photoName}>{removeFileExtension(photo.displayName)}</p>
                )}
                <div className={styles.actionsContainer}>
                  <button 
                    onClick={(e) => handleAddToCart(e, photo, 'digital', DIGITAL_PHOTO_PRICE)}
                    className={styles.actionButton}
                  >
                    Buy Digital
                  </button>
                  <button 
                    onClick={(e) => handleAddToCart(e, photo, 'print', PRINTED_PHOTO_PRICE, { type: 'standard_print' })}
                    className={styles.actionButton}
                  >
                    Buy Print
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && selectedImage && (
        <div className={styles.modalOverlay} onClick={closeModal} role="dialog" aria-modal="true">
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeButton} onClick={closeModal} aria-label="Close image viewer">&times;</button>
            <div className={styles.modalImageContainer}>
              <img src={selectedImage} alt="Enlarged view" className={styles.modalImage} />
              {/* Watermark in modal view */}
              {watermarkUrl && (
                <div className={styles.watermarkOverlay}>
                  <img 
                    src={watermarkUrl} 
                    alt="Watermark" 
                    className={styles.watermark}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}