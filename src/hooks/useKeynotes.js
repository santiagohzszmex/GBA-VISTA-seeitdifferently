import { useCallback, useState } from 'react';
import { supabase } from '../supabaseClient';

const PUBLIC_KEYNOTE_FIELDS = 'id,workspace_document_id,slug,title,summary,content_markdown,keynote_date,published_at,updated_at';

export function useKeynotes() {
  const [keynotes, setKeynotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPublishedKeynotes = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const { data, error: queryError } = await supabase
        .from('gba_keynotes')
        .select(PUBLIC_KEYNOTE_FIELDS)
        .eq('is_published', true)
        .order('keynote_date', { ascending: false })
        .order('published_at', { ascending: false });

      if (queryError) throw queryError;
      const published = data || [];
      setKeynotes(published);
      return published;
    } catch (queryError) {
      console.error('No se pudieron cargar las Keynotes:', queryError);
      setError('Las Keynotes todavía no están disponibles.');
      setKeynotes([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return { keynotes, loading, error, fetchPublishedKeynotes };
}
