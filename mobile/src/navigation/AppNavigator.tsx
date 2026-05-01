import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";
import { supabase } from "../lib/supabase";
import { c } from "../lib/theme";
import LoginScreen           from "../screens/LoginScreen";
import HomeScreen            from "../screens/HomeScreen";
import NewPaperScreen        from "../screens/NewPaperScreen";
import SelectTestScreen      from "../screens/SelectTestScreen";
import ScanScreen            from "../screens/ScanScreen";
import TestResultsScreen     from "../screens/TestResultsScreen";
import ResultDetailScreen    from "../screens/ResultDetailScreen";
import CorrectedCopiesScreen from "../screens/CorrectedCopiesScreen";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const [session, setSession] = useState<any>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.bg },
          animation: "slide_from_right",
        }}
      >
        {session ? (
          <>
            <Stack.Screen name="Home"            component={HomeScreen} />
            <Stack.Screen name="NewPaper"        component={NewPaperScreen} />
            <Stack.Screen name="SelectTest"      component={SelectTestScreen} />
            <Stack.Screen name="Scan"            component={ScanScreen} />
            <Stack.Screen name="TestResults"     component={TestResultsScreen} />
            <Stack.Screen name="ResultDetail"    component={ResultDetailScreen} />
            <Stack.Screen name="CorrectedCopies" component={CorrectedCopiesScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
