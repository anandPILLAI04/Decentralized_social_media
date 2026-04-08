const { HfInference } = require('@huggingface/inference');

/**
 * Enhanced AI Service for Content Moderation (Text Only)
 * Multi-tier approach: Enhanced Rules → Hugging Face Text Models
 */
class AIService {
  constructor() {
    // Debug environment loading
    console.log('🔍 Environment debugging:');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('All HF keys:', Object.keys(process.env).filter(k => k.includes('HF') || k.includes('HUGGING')));
    
    this.huggingFaceKey = process.env.HF_TOKEN || process.env.HUGGING_FACE_API_KEY || process.env.HUGGINGFACE_API_KEY;
    this.enabled = process.env.AI_MODERATION_ENABLED !== 'false';
    
    // Initialize Hugging Face client for text moderation only
    if (this.huggingFaceKey) {
      console.log('🔑 Hugging Face API Key found:', this.huggingFaceKey.substring(0, 10) + '...');
      console.log('🔍 Token verification:', typeof this.huggingFaceKey, 'length:', this.huggingFaceKey.length);
      
      try {
        this.hf = new HfInference(this.huggingFaceKey);
        console.log('✅ HfInference client initialized successfully');
        
        // Check token permissions during initialization
        this.initTokenPermissions();
      } catch (error) {
        console.error('❌ Failed to initialize HfInference client:', error);
        this.enabled = false;
      }
    } else {
      console.log('❌ No Hugging Face API Key found in environment variables');
      this.enabled = false;
    }
    
    // Enhanced rule-based text moderation patterns
    this.toxicWords = [
      // Explicit profanity
      'fuck', 'shit', 'damn', 'bitch', 'asshole', 'bastard', 'cunt', 'dick',
      // Hate speech indicators  
      'nazi', 'hitler', 'terrorist', 'kill yourself', 'kys', 'retard', 'stupid', 'idiot', 'moron',
      // Crypto scams
      'pump and dump', 'rug pull', 'ponzi', 'get rich quick', 'guaranteed returns',
      // Spam indicators
      'click here', 'limited time', 'act now', 'urgent', 'free money',
      // Harassment
      'doxxing', 'swatting', 'harassment', 'stalk', 'die', 'kill', 'hate you'
    ];
    
    this.scamPatterns = [
      /(\$[A-Z]{3,10})\s*(moon|rocket|🚀|📈)/i,
      /follow.*back/i,
      /dm.*me/i,
      /(https?:\/\/[^\s]+){3,}/i,
      /send.*money/i,
      /100%.*guaranteed/i,
      /double.*crypto/i,
      /send.*\d+.*receive.*\d+/i,
      /check.*bio.*link/i
    ];

    this.suspiciousPatterns = [
      /join.*telegram/i,
      /whatsapp.*group/i,
      /free.*nft/i,
      /airdrop.*free/i,
      /click.*link.*below/i,
      /cashapp.*venmo/i,
      /bitcoin.*address/i
    ];

    console.log('🤗 AI Service initialized (text moderation only):', {
      huggingFaceEnabled: !!this.huggingFaceKey,
      ruleBasedEnabled: true,
      imageModEnabled: false
    });
  }

  /**
   * Check token permissions and available models (text only)
   */
  async initTokenPermissions() {
    try {
      const axios = require('axios');
      const response = await axios.get('https://huggingface.co/api/whoami-v2', {
        headers: { 'Authorization': `Bearer ${this.huggingFaceKey}` }
      });
      
      const tokenInfo = response.data;
      console.log('🔑 Token permissions:', {
        role: tokenInfo.auth?.accessToken?.role || 'unknown',
        type: tokenInfo.type,
        canPay: tokenInfo.canPay,
        isPro: tokenInfo.isPro
      });
      
      console.log('ℹ️ Text moderation enabled with current token permissions');
    } catch (error) {
      console.warn('⚠️ Could not check token permissions:', error.message);
    }
  }

  /**
   * Main content moderation method (text only)
   * Multi-tier approach with Hugging Face as primary AI
   */
  async moderateContent(text, userHistory = {}) {
    if (!this.enabled) {
      return { action: 'approve', confidence: 1.0, reason: 'Moderation disabled' };
    }

    console.log('🔍 Starting text content moderation...');

    try {
      // Tier 1: Enhanced rule-based moderation (instant, reliable)
      const rulesResult = this.enhancedRuleBasedModeration(text, userHistory);
      if (rulesResult.action === 'flag') {
        console.log('🚩 Content flagged by enhanced rules');
        return {
          action: 'flag',
          confidence: rulesResult.confidence,
          reason: rulesResult.reason,
          provider: 'enhanced-rules',
          details: rulesResult.details
        };
      }

      // Tier 2: Hugging Face multi-model analysis (free, highly accurate)
      const huggingFaceResult = await this.huggingFaceMultiModelAnalysis(text);
      if (huggingFaceResult.action === 'flag') {
        console.log('🤗 Content flagged by Hugging Face models');
        return {
          action: 'flag',
          confidence: huggingFaceResult.confidence,
          reason: huggingFaceResult.reason,
          provider: 'hugging-face',
          details: huggingFaceResult.details
        };
      }

      // If we get here, content passed all checks
      const finalConfidence = Math.max(
        rulesResult.confidence,
        huggingFaceResult.confidence || 0.1
      );

      return {
        action: 'approve',
        confidence: 1 - finalConfidence,
        reason: 'Content passed all moderation checks',
        provider: 'multi-tier',
        details: {
          rules: rulesResult,
          huggingFace: huggingFaceResult
        }
      };

    } catch (error) {
      console.error('❌ Moderation error:', error);
      return {
        action: 'approve',
        confidence: 0.5,
        reason: 'Moderation system error, defaulting to approve',
        error: error.message
      };
    }
  }

  /**
   * Hugging Face multi-model content analysis
   * Uses multiple models for comprehensive toxicity detection
   */
  async huggingFaceMultiModelAnalysis(text) {
    if (!this.hf) {
      console.log('🤗 Hugging Face client not initialized, falling back to rule-based');
      return {
        action: 'continue',
        confidence: 0.1,
        reason: 'Hugging Face API not available',
        details: {},
        processed: false
      };
    }

    const results = {
      toxicity: null,
      offensive: null,
      emotion: null,
      processed: false
    };

    try {
      console.log('🤗 Running Hugging Face multi-model analysis...');

      // Primary toxicity detection using unitary/toxic-bert (most accurate for toxicity)
      try {
        console.log('📡 Calling toxic-bert model...');
        const toxicityResult = await Promise.race([
          this.hf.textClassification({
            inputs: text,
            model: "unitary/toxic-bert"
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('HF request timeout after 10s')), 10000)
          )
        ]);
        results.toxicity = toxicityResult;
        console.log('✅ Toxicity result:', toxicityResult);
      } catch (error) {
        console.error('❌ Toxicity model error:', error.message);
        results.toxicity = null;
      }

      // Alternative toxicity detection
      try {
        console.log('📡 Calling toxic-comment model...');
        const altToxicityResult = await Promise.race([
          this.hf.textClassification({
            inputs: text,
            model: "martin-ha/toxic-comment-model"
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('HF request timeout after 10s')), 10000)
          )
        ]);
        results.offensive = altToxicityResult;
        console.log('✅ Alternative toxicity result:', altToxicityResult);
      } catch (error) {
        console.error('❌ Alternative toxicity model error:', error.message);
        results.offensive = null;
      }

      // Sentiment analysis for emotional content
      try {
        console.log('📡 Calling sentiment model...');
        const emotionResult = await Promise.race([
          this.hf.textClassification({
            inputs: text,
            model: "citizenlab/twitter-xlm-roberta-base-sentiment-finetunned"
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('HF request timeout after 10s')), 10000)
          )
        ]);
        results.emotion = emotionResult;
        console.log('✅ Emotion result:', emotionResult);
      } catch (error) {
        console.error('❌ Emotion model error:', error.message);
        results.emotion = null;
      }

      results.processed = true;

      // Analyze results for flagging
      let shouldFlag = false;
      let maxConfidence = 0;
      let primaryReason = '';
      const flagReasons = [];

      // Check toxicity results (including threat/violence detection)
      if (results.toxicity && Array.isArray(results.toxicity)) {
        const toxicItems = results.toxicity.filter(item => {
          const label = item.label?.toLowerCase() || '';
          return (label === 'toxic' || label === 'threat' || label === 'severe_toxic') && item.score > 0.7;
        });
        if (toxicItems.length > 0) {
          shouldFlag = true;
          maxConfidence = Math.max(maxConfidence, toxicItems[0].score);
          primaryReason = 'toxic_content';
          // Get specific threat detection
          const threatItems = toxicItems.filter(t => t.label?.toLowerCase() === 'threat');
          if (threatItems.length > 0) {
            flagReasons.push(`🚨 THREATS/VIOLENCE DETECTED (${(threatItems[0].score * 100).toFixed(1)}%)`);
          } else {
            flagReasons.push('High toxicity detected');
          }
          console.log('🚩 Toxicity detection triggered:', toxicItems);
        }
      }

      // Check alternative toxicity
      if (results.offensive && Array.isArray(results.offensive)) {
        const offensiveItems = results.offensive.filter(item => {
          const label = item.label?.toLowerCase() || '';
          return (label === 'toxic' || label === 'offensive') && item.score > 0.7;
        });
        if (offensiveItems.length > 0) {
          shouldFlag = true;
          maxConfidence = Math.max(maxConfidence, offensiveItems[0].score);
          primaryReason = 'offensive_content';
          flagReasons.push('Offensive language detected');
          console.log('🚩 Offensive detection triggered:', offensiveItems);
        }
      }

      // Check negative emotion (very strong negative sentiment)
      if (results.emotion && Array.isArray(results.emotion)) {
        const negativeItems = results.emotion.filter(item => {
          const label = item.label?.toLowerCase() || '';
          return (label === 'negative' || label === 'anger' || label === 'hate') && item.score > 0.85;
        });
        if (negativeItems.length > 0) {
          shouldFlag = true;
          maxConfidence = Math.max(maxConfidence, negativeItems[0].score * 0.8); // Lower weight for emotions
          primaryReason = primaryReason || 'negative_sentiment';
          flagReasons.push('Strongly negative content detected');
          console.log('🚩 Negative sentiment triggered:', negativeItems);
        }
      }

      if (shouldFlag) {
        console.log('🚩 AI flagged content with confidence:', maxConfidence);
        return {
          action: 'flag',
          confidence: maxConfidence,
          reason: primaryReason,
          details: {
            reasons: flagReasons,
            modelResults: results,
            threshold_exceeded: true
          },
          processed: true
        };
      }

      console.log('✅ AI approved content');
      return {
        action: 'continue',
        confidence: maxConfidence,
        reason: 'Content passed AI analysis',
        details: {
          modelResults: results,
          all_models_safe: true
        },
        processed: true
      };

    } catch (error) {
      console.error('🤗 Hugging Face analysis error:', error.message);
      console.error('Stack:', error.stack);
      return {
        action: 'continue',
        confidence: 0.1,
        reason: 'AI analysis failed, continuing with rules',
        details: {
          error: error.message,
          provider: 'error_fallback'
        },
        processed: false
      };
    }
  }

  /**
   * Enhanced rule-based moderation with pattern matching and context awareness
   */
  enhancedRuleBasedModeration(text, userHistory = {}) {
    if (!text || typeof text !== 'string') {
      return {
        action: 'approve',
        confidence: 0.1,
        reason: 'No text to analyze',
        details: {}
      };
    }

    const lowerText = text.toLowerCase();
    let riskScore = 0;
    const flagReasons = [];
    const details = {};

    // 1. Direct toxic word matching (weighted by severity)
    const foundToxicWords = this.toxicWords.filter(word => lowerText.includes(word.toLowerCase()));
    if (foundToxicWords.length > 0) {
      const toxicScore = Math.min(foundToxicWords.length * 0.3, 1.0);
      riskScore += toxicScore;
      flagReasons.push(`Contains ${foundToxicWords.length} toxic word(s): ${foundToxicWords.slice(0, 3).join(', ')}`);
      details.toxic_words = foundToxicWords;
    }

    // 2. Scam pattern detection
    const matchedScamPatterns = this.scamPatterns.filter(pattern => pattern.test(text));
    if (matchedScamPatterns.length > 0) {
      riskScore += 0.4;
      flagReasons.push('Contains potential scam patterns');
      details.scam_patterns = matchedScamPatterns.length;
    }

    // 3. Suspicious pattern detection
    const matchedSuspiciousPatterns = this.suspiciousPatterns.filter(pattern => pattern.test(text));
    if (matchedSuspiciousPatterns.length > 0) {
      riskScore += 0.2;
      flagReasons.push('Contains suspicious patterns');
      details.suspicious_patterns = matchedSuspiciousPatterns.length;
    }

    // 4. Context-aware scoring adjustments
    if (userHistory.violations > 3) {
      riskScore += 0.2;
      flagReasons.push('User has history of violations');
      details.repeat_offender = true;
    }

    // 5. Content length and caps analysis
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (capsRatio > 0.6 && text.length > 20) {
      riskScore += 0.1;
      flagReasons.push('Excessive use of capital letters');
      details.excessive_caps = true;
    }

    // 6. Repeated character/word detection (spam indicators)
    const repeatedChars = /(.)\1{4,}/g.test(text);
    const repeatedWords = /\b(\w+)(\s+\1\b){2,}/gi.test(text);
    if (repeatedChars || repeatedWords) {
      riskScore += 0.2;
      flagReasons.push('Contains spam-like repetition');
      details.spam_repetition = true;
    }

    // Determine final action based on cumulative risk score
    details.risk_score = riskScore;
    details.analysis_timestamp = new Date().toISOString();

    if (riskScore > 0.7) {
      return {
        action: 'flag',
        confidence: Math.min(riskScore, 0.95),
        reason: 'high_risk_content',
        details: {
          ...details,
          flag_reasons: flagReasons,
          severity: 'high'
        }
      };
    } else if (riskScore > 0.4) {
      return {
        action: 'review',
        confidence: riskScore,
        reason: 'moderate_risk_content',
        details: {
          ...details,
          flag_reasons: flagReasons,
          severity: 'moderate'
        }
      };
    }

    return {
      action: 'approve',
      confidence: 1 - riskScore,
      reason: 'content_safe',
      details: {
        ...details,
        passed_all_checks: true
      }
    };
  }

  /**
   * Analyze user posting behavior patterns for context
   */
  analyzeUserBehavior(userHistory) {
    const analysis = {
      risk_level: 'low',
      trust_score: 1.0,
      red_flags: []
    };

    if (userHistory.violations > 5) {
      analysis.risk_level = 'high';
      analysis.trust_score = 0.2;
      analysis.red_flags.push('Multiple violations');
    } else if (userHistory.violations > 2) {
      analysis.risk_level = 'medium';
      analysis.trust_score = 0.6;
      analysis.red_flags.push('Some violations');
    }

    if (userHistory.spam_reports > 3) {
      analysis.risk_level = 'high';
      analysis.trust_score = Math.min(analysis.trust_score, 0.3);
      analysis.red_flags.push('Multiple spam reports');
    }

    return analysis;
  }

  /**
   * Get current service status
   */
  getStatus() {
    return {
      enabled: this.enabled,
      huggingface_available: !!this.hf,
      rule_based_available: true,
      image_moderation: false, // Completely removed
      models: {
        text_toxicity: 'unitary/toxic-bert',
        text_offensive: 'martin-ha/toxic-comment-model',
        text_sentiment: 'citizenlab/twitter-xlm-roberta-base-sentiment-finetunned'
      }
    };
  }
}

module.exports = AIService;