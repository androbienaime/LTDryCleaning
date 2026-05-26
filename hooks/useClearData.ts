import AsyncStorage from "@react-native-async-storage/async-storage";

 export const resetStorage = async () => {
  await AsyncStorage.clear();
  console.log('Storage reset: all data cleared.');
};