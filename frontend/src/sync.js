import axios from 'axios';

const getApiUrl = (username) => `/api/sync/${username}`;

const KEYS_TO_SYNC = [
  'points',
  'pointsHistory',
  'inventory',
  'learningStats',
  'mathLevel',
  'vietLevel',
  'mathDifficultyLevels',
  'mathTimeLevels',
  'vietnameseModuleLevels',
  'learningLevelProgress',
  'learningRewardProgress',
  'learningLevelSchemaVersion',
  'interventionPlans',
  'guidedPracticeLogs',
  'weeklyGoals',
  'parentNotes',
  'learningPreferences'
];

export const pullFromServer = async (username) => {
  if (!username) return;
  try {
    const res = await axios.get(getApiUrl(username));
    const data = res.data;
    if (data && Object.keys(data).length > 0) {
      KEYS_TO_SYNC.forEach(key => {
        const fullKey = `${key}_${username}`;
        if (data[key] !== undefined) {
          localStorage.setItem(fullKey, typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]));
        }
      });
      console.log(`Pulled data for ${username} from server.`);
    }
  } catch (err) {
    console.error("Failed to pull from server:", err);
  }
};

export const syncToServer = async (username) => {
  if (!username) return;
  try {
    const payload = {};
    KEYS_TO_SYNC.forEach(key => {
      const fullKey = `${key}_${username}`;
      const val = localStorage.getItem(fullKey);
      if (val) {
        try {
          payload[key] = JSON.parse(val);
        } catch {
          payload[key] = val; // strings like level or points
        }
      }
    });
    
    await axios.post(getApiUrl(username), payload);
    console.log(`Synced data for ${username} to server.`);
  } catch (err) {
    console.error("Failed to sync to server:", err);
  }
};
