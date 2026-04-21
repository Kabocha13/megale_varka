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

  if (data[kStreakKey]) {
    [shared setObject:data[kStreakKey] forKey:kStreakKey];
  }
  if (data[kMoodKey]) {
    [shared setObject:data[kMoodKey] forKey:kMoodKey];
  }
  if (data[kSleepKey]) {
    [shared setObject:data[kSleepKey] forKey:kSleepKey];
  }
  [shared setDouble:([[NSDate date] timeIntervalSince1970] * 1000) forKey:kUpdatedKey];
  [shared synchronize];

  resolve(nil);
}

@end
