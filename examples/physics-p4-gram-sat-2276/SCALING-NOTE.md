# Integer Gram scaling clarification

The frozen design0dee0dae uses the shorthand `AA01=-epsilon*(1+epsilon)` for the admitted raw quaternion control q=(.5,.5,.5,.5+epsilon), epsilon=2^-42. That expression is the PHYSICAL dot of columns A0/da and A1/da. The actual integer table entry is

`AA01 = -da² * epsilon * (1+epsilon)`.

The candidate computes m.dot on the actual prepared integer columns and never inserts either closed expression as an oracle value. The raw denominator da is the one supplied by the unchanged old preparation; normalized and raw denominators are not exchanged. The frozen design remains unchanged. This note corrects its omitted scale factor without changing the input case or any numerical tolerance.
