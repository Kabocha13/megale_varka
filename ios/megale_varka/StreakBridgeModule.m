#import "StreakBridgeModule.h"

static NSString * const kAppGroupID = @"group.com.kabocha13.megale-varka";
static NSString * const kStreakKey  = @"streakCount";
static NSString * const kMoodKey    = @"avgMood";
static NSString * const kSleepKey   = @"avgSleepHours";
static NSString * const kUpdatedKey = @"updatedAt";

@implementation StreakBridgeModule

RCT_EXPORT_MODULE(StreakBridge)

RCT_EXPORT_METHOD(saveStreakData:(NSDictionary *)data
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)
{
  NSUserDefaults *shared = [[NSUserDefaults alloc] initWithSuiteName:kAppGroupID];
  if (!shared) {
    reject(@"APP_GROUP_ERROR", @"App Group UserDefaults not available", nil);
    return;
  }

  // Store streak count (always a number).
  if (data[kStreakKey] && data[kStreakKey] != [NSNull null]) {
    [shared setObject:data[kStreakKey] forKey:kStreakKey];
  }

  // Store optional numeric values; remove the key when the JS side sends null
  // so the widget can distinguish "no data" from "zero".
  id moodValue = data[kMoodKey];
  if (moodValue && moodValue != [NSNull null]) {
    [shared setObject:moodValue forKey:kMoodKey];
  } else {
    [shared removeObjectForKey:kMoodKey];
  }

  id sleepValue = data[kSleepKey];
  if (sleepValue && sleepValue != [NSNull null]) {
    [shared setObject:sleepValue forKey:kSleepKey];
  } else {
    [shared removeObjectForKey:kSleepKey];
  }

  [shared setDouble:([[NSDate date] timeIntervalSince1970] * 1000) forKey:kUpdatedKey];
  [shared synchronize];

  resolve(nil);
}

@end
