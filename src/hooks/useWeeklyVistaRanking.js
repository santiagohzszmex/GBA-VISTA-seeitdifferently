import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';

const MAX_EDITORIAL_EDITIONS = 5;
const MEXICO_CITY_OFFSET_MS = 6 * 60 * 60 * 1000;
const WEEKLY_RANKING_LAUNCH = new Date('2026-07-28T00:00:00-06:00');

const getMexicoCityWeekWindow = (reference = new Date()) => {
  const mexicoClock = new Date(reference.getTime() - MEXICO_CITY_OFFSET_MS);
  const daysSinceMonday = (mexicoClock.getUTCDay() + 6) % 7;
  mexicoClock.setUTCHours(0, 0, 0, 0);
  mexicoClock.setUTCDate(mexicoClock.getUTCDate() - daysSinceMonday);

  const start = new Date(mexicoClock.getTime() + MEXICO_CITY_OFFSET_MS);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);

  return { start, end };
};

const getPublisher = (item) => {
  if (item.es_comunidad === false) {
    return {
      key: 'gimg',
      followKey: 'GIMG',
      name: 'Global Insight',
      type: 'official'
    };
  }

  const name = item.sello_editorial?.trim() || 'Editorial Independiente';
  return {
    key: name.toLocaleLowerCase('es-MX'),
    followKey: name,
    name,
    type: 'independent'
  };
};

const normalize = (value, maximum) => maximum > 0 ? value / maximum : 0;

export function useWeeklyVistaRanking(allNews = []) {
  const [referenceTime, setReferenceTime] = useState(() => new Date());
  const [followers, setFollowers] = useState({});
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const mode = referenceTime >= WEEKLY_RANKING_LAUNCH ? 'weekly' : 'historical';
  const weekWindow = useMemo(() => getMexicoCityWeekWindow(referenceTime), [referenceTime]);

  useEffect(() => {
    const timer = window.setInterval(() => setReferenceTime(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const publishers = useMemo(() => {
    const grouped = new Map();

    allNews.forEach((item) => {
      if (mode === 'weekly') {
        const publishedAt = new Date(item.created_at);
        if (Number.isNaN(publishedAt.getTime())) return;
        if (publishedAt < weekWindow.start || publishedAt >= weekWindow.end) return;
      }

      const publisher = getPublisher(item);
      const current = grouped.get(publisher.key) || { ...publisher, items: [] };
      current.items.push(item);
      grouped.set(publisher.key, current);
    });

    return [...grouped.values()].map((publisher) => {
      const evaluatedEditions = mode === 'weekly'
        ? [...publisher.items]
          .sort((a, b) => {
            const scoreA = (Number(a.vistas) || 0) + ((Number(a.likes_count) || 0) * 3);
            const scoreB = (Number(b.vistas) || 0) + ((Number(b.likes_count) || 0) * 3);
            return scoreB - scoreA;
          })
          .slice(0, MAX_EDITORIAL_EDITIONS)
        : publisher.items;

      const views = evaluatedEditions.reduce((sum, item) => sum + (Number(item.vistas) || 0), 0);
      const likes = evaluatedEditions.reduce((sum, item) => sum + (Number(item.likes_count) || 0), 0);

      return {
        ...publisher,
        editions: publisher.items.length,
        evaluatedEditions: evaluatedEditions.length,
        views,
        likes,
        averageViews: evaluatedEditions.length > 0 ? views / evaluatedEditions.length : 0,
        engagementRate: likes / Math.max(views + 10, 1)
      };
    });
  }, [allNews, mode, weekWindow]);

  const publisherSignature = useMemo(
    () => publishers.map(publisher => `${publisher.key}:${publisher.followKey}`).sort().join('|'),
    [publishers]
  );

  useEffect(() => {
    let cancelled = false;

    const loadFollowers = async () => {
      if (publishers.length === 0) {
        setFollowers({});
        setLoadingFollowers(false);
        return;
      }

      setLoadingFollowers(true);
      const entries = await Promise.all(publishers.map(async (publisher) => {
        const { data, error } = await supabase.rpc('get_editorial_followers_count', {
          p_sello: publisher.followKey
        });
        return [publisher.key, error ? 0 : (Number(data) || 0)];
      }));

      if (!cancelled) {
        setFollowers(Object.fromEntries(entries));
        setLoadingFollowers(false);
      }
    };

    loadFollowers();
    return () => {
      cancelled = true;
    };
  }, [publisherSignature]);

  const ranking = useMemo(() => {
    const metrics = publishers.map((publisher) => ({
      ...publisher,
      followers: followers[publisher.key] || 0,
      reachSignal: Math.log1p(publisher.averageViews),
      interactionSignal: publisher.engagementRate,
      communitySignal: Math.log1p(followers[publisher.key] || 0)
    }));

    const maximums = metrics.reduce((current, publisher) => ({
      reach: Math.max(current.reach, publisher.reachSignal),
      interaction: Math.max(current.interaction, publisher.interactionSignal),
      community: Math.max(current.community, publisher.communitySignal)
    }), { reach: 0, interaction: 0, community: 0 });

    return metrics.map((publisher) => {
      const reachPoints = normalize(publisher.reachSignal, maximums.reach) * 40;
      const interactionPoints = normalize(publisher.interactionSignal, maximums.interaction) * 30;
      const communityPoints = normalize(publisher.communitySignal, maximums.community) * 20;
      const activityPoints = publisher.editions > 0 ? 10 : 0;
      const score = reachPoints + interactionPoints + communityPoints + activityPoints;

      return {
        ...publisher,
        score: Number(score.toFixed(1)),
        breakdown: {
          reach: Number(reachPoints.toFixed(1)),
          interaction: Number(interactionPoints.toFixed(1)),
          community: Number(communityPoints.toFixed(1)),
          activity: activityPoints
        }
      };
    }).sort((a, b) =>
      b.score - a.score
      || b.views - a.views
      || b.likes - a.likes
      || a.name.localeCompare(b.name, 'es-MX')
    ).slice(0, 5);
  }, [followers, publishers]);

  return {
    ranking,
    loading: loadingFollowers,
    mode,
    weekStart: weekWindow.start,
    weekEnd: weekWindow.end
  };
}
