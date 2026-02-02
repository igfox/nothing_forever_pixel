// TopicManager - Server-side topic selection with rotation tracking and Wikipedia integration
const fs = require('fs');
const path = require('path');

class TopicManager {
    constructor() {
        this.allTopics = [];
        this.usedTopics = [];
        this.maxHistory = 500; // ~16 hours of content
        this.wikipediaCache = [];
        this.wikipediaCacheSize = 10;
        this.wikipediaRefreshInterval = 30 * 60 * 1000; // 30 minutes
        this.wikipediaWeight = 0.3; // 30% Wikipedia, 70% static

        this.loadTopics();
        this.refreshWikipediaCache();
        this.wikipediaTimer = setInterval(() => this.refreshWikipediaCache(), this.wikipediaRefreshInterval);
    }

    /**
     * Load and flatten all topics from data/topics.json
     */
    loadTopics() {
        try {
            const topicsPath = path.join(__dirname, '..', 'data', 'topics.json');
            const raw = fs.readFileSync(topicsPath, 'utf-8');
            const topicsByCategory = JSON.parse(raw);

            this.allTopics = [];
            for (const [category, topics] of Object.entries(topicsByCategory)) {
                for (const topic of topics) {
                    this.allTopics.push({ topic, category, source: 'static' });
                }
            }

            console.log(`[TOPICS] Loaded ${this.allTopics.length} topics from ${Object.keys(topicsByCategory).length} categories`);
        } catch (error) {
            console.error('[TOPICS] Failed to load topics.json:', error.message);
            this.allTopics = [
                { topic: "The group debates a ridiculous topic", category: "fallback", source: "static" },
                { topic: "Larry complains about a minor inconvenience", category: "fallback", source: "static" },
                { topic: "Someone has a scheme that will obviously backfire", category: "fallback", source: "static" },
                { topic: "A mundane situation spirals out of control", category: "fallback", source: "static" },
                { topic: "Someone discovers something absurd", category: "fallback", source: "static" }
            ];
        }
    }

    /**
     * Fetch random Wikipedia articles and transform into conversation premises
     */
    async refreshWikipediaCache() {
        const newCache = [];
        const fetches = [];

        for (let i = 0; i < this.wikipediaCacheSize; i++) {
            fetches.push(this.fetchWikipediaArticle());
        }

        const results = await Promise.allSettled(fetches);
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
                newCache.push(result.value);
            }
        }

        if (newCache.length > 0) {
            this.wikipediaCache = newCache;
            console.log(`[TOPICS] Wikipedia cache refreshed: ${newCache.length} articles`);
        } else {
            console.warn('[TOPICS] Wikipedia cache refresh failed, keeping existing cache');
        }
    }

    /**
     * Fetch a single random Wikipedia article and convert to a topic premise
     */
    async fetchWikipediaArticle() {
        try {
            const response = await fetch('https://en.wikipedia.org/api/rest_v1/page/random/summary', {
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) return null;

            const data = await response.json();
            const title = data.title;
            const extract = data.extract;

            if (!title || !extract || extract.length < 50) return null;

            // Transform into a conversational premise
            const premise = this.wikipediaToPremise(title, extract);
            return {
                topic: premise,
                category: 'wikipedia',
                source: 'wikipedia',
                originalTitle: title
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Convert a Wikipedia article into a sitcom conversation premise
     */
    wikipediaToPremise(title, extract) {
        // Take the first sentence or two and frame it as something the characters would discuss
        const firstSentence = extract.split('. ').slice(0, 2).join('. ');
        const truncated = firstSentence.length > 200 ? firstSentence.substring(0, 200) + '...' : firstSentence;

        const framings = [
            `Someone brings up the fact that ${truncated}`,
            `The group learns about "${title}" and has opinions`,
            `A conversation about ${title} spirals into an argument`,
            `Someone claims to be an expert on ${title}`,
            `The topic of ${title} comes up unexpectedly`,
            `Someone read an article about ${title} and won't stop talking about it`
        ];

        return framings[Math.floor(Math.random() * framings.length)];
    }

    /**
     * Get a topic that hasn't been used recently
     * Returns: { topic: string, category: string, source: 'static' | 'wikipedia' }
     */
    getTopic() {
        const useWikipedia = Math.random() < this.wikipediaWeight && this.wikipediaCache.length > 0;

        if (useWikipedia) {
            // Pick from Wikipedia cache
            const idx = Math.floor(Math.random() * this.wikipediaCache.length);
            const topic = this.wikipediaCache[idx];

            // Remove used article from cache so it's not reused
            this.wikipediaCache.splice(idx, 1);

            // Trigger background refill if cache is getting low
            if (this.wikipediaCache.length < 3) {
                this.refreshWikipediaCache();
            }

            this.trackUsed(topic.topic);
            return topic;
        }

        // Pick from static bank with rotation tracking
        return this.getStaticTopic();
    }

    /**
     * Pick a static topic that hasn't been used recently, with re-roll on duplicates
     */
    getStaticTopic() {
        const maxAttempts = 20;

        for (let i = 0; i < maxAttempts; i++) {
            const idx = Math.floor(Math.random() * this.allTopics.length);
            const candidate = this.allTopics[idx];

            if (!this.usedTopics.includes(candidate.topic)) {
                this.trackUsed(candidate.topic);
                return candidate;
            }
        }

        // If all re-rolls hit used topics (unlikely with 5000+), just pick one anyway
        const idx = Math.floor(Math.random() * this.allTopics.length);
        const fallback = this.allTopics[idx];
        this.trackUsed(fallback.topic);
        return fallback;
    }

    /**
     * Track a topic as used, maintaining a rolling window
     */
    trackUsed(topicText) {
        this.usedTopics.push(topicText);
        if (this.usedTopics.length > this.maxHistory) {
            this.usedTopics.shift();
        }
    }

    /**
     * Get stats about the topic system
     */
    getStats() {
        return {
            totalStaticTopics: this.allTopics.length,
            usedRecently: this.usedTopics.length,
            wikipediaCacheSize: this.wikipediaCache.length,
            historyWindow: this.maxHistory
        };
    }
}

module.exports = TopicManager;
