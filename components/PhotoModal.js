{\rtf1\ansi\ansicpg1252\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;\red255\green255\blue255;}
{\*\expandedcolortbl;;\cssrgb\c100000\c100000\c100000;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\deftab720
\pard\pardeftab720\partightenfactor0

\f0\fs24 \cf2 \expnd0\expndtw0\kerning0
\outl0\strokewidth0 \strokec2 // components/PhotoModal.js\
import \{ useState \} from 'react';\
import \{ supabase \} from '../lib/supabase';\
import styles from '../styles/PhotoModal.module.css';\
\
export default function PhotoModal(\{ photo, onClose \}) \{\
  const [type, setType] = useState('');\
  const [loading, setLoading] = useState(false);\
  const [message, setMessage] = useState('');\
\
  const handleAddToCart = async () => \{\
    if (!type) \{\
      setMessage('Please select a photo type');\
      return;\
    \}\
\
    setLoading(true);\
    setMessage('');\
\
    try \{\
      const \{ data: \{ session \} \} = await supabase.auth.getSession();\
      if (!session) \{\
        setMessage('Please log in to add items to cart');\
        return;\
      \}\
\
      const \{ error \} = await supabase\
        .from('cart_items')\
        .insert(\{\
          user_id: session.user.id,\
          photo_id: photo.id,\
          type\
        \});\
\
      if (error) throw error;\
\
      setMessage('Added to cart!');\
      setTimeout(() => \{\
        onClose();\
      \}, 1500);\
    \} catch (error) \{\
      console.error('Error adding to cart:', error);\
      setMessage('Error adding to cart. Please try again.');\
    \} finally \{\
      setLoading(false);\
    \}\
  \};\
\
  return (\
    <div className=\{styles.modalOverlay\}>\
      <div className=\{styles.modal\}>\
        <button className=\{styles.closeButton\} onClick=\{onClose\}>\'d7</button>\
\
        <div className=\{styles.modalContent\}>\
          <div className=\{styles.photoContainer\}>\
            <img\
              src=\{photo.url\}\
              alt=\{photo.filename\}\
              className=\{styles.photo\}\
            />\
          </div>\
\
          <div className=\{styles.photoDetails\}>\
            <h3>\{photo.filename\}</h3>\
\
            <div className=\{styles.typeSelection\}>\
              <h4>How would you like this photo?</h4>\
\
              <div className=\{styles.typeOptions\}>\
                <label className=\{styles.typeOption\}>\
                  <input\
                    type="radio"\
                    name="type"\
                    value="digital"\
                    checked=\{type === 'digital'\}\
                    onChange=\{() => setType('digital')\}\
                  />\
                  <span>Digital (\'804)</span>\
                </label>\
\
                <label className=\{styles.typeOption\}>\
                  <input\
                    type="radio"\
                    name="type"\
                    value="printed"\
                    checked=\{type === 'printed'\}\
                    onChange=\{() => setType('printed')\}\
                  />\
                  <span>Printed (\'808)</span>\
                </label>\
              </div>\
            </div>\
\
            <button\
              className=\{styles.addButton\}\
              onClick=\{handleAddToCart\}\
              disabled=\{loading\}\
            >\
              \{loading ? 'Adding...' : 'Add to Cart'\}\
            </button>\
\
            \{message && <p className=\{styles.message\}>\{message\}</p>\}\
          </div>\
        </div>\
      </div>\
    </div>\
  );\
\}}