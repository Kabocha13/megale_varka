#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(StreakBridgeModule, NSObject)
RCT_EXTERN_METHOD(update:(NSInteger)streak recordedToday:(BOOL)recordedToday)
@end
