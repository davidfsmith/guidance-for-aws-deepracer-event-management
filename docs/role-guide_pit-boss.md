<p align="center">
	<img src="./images/logo_pit-crew.png" width="300"> 
</p>

# DeepRacer Events - Role Guide

## Pit Boss

Pit Bosses are responsible for the end-to-end interaction with racers, preparing them to race, loading models onto the cars, maintaining the flow of racers through the track, and maintaining cars track-side as necessary.

### TENETS

* Keeping the cars and the customers racing
* Customer Experience is the priority
* Racing is fun and fair

### REQUIREMENTS

* Wear appropriate clothing (Depending on the type of event) to move comfortably in, be aware you could be on your feet for the duration of your sift or the event.
* Be comfortable with speaking to customers in detail about the racing process and providing instruction
* Be familiar with any rules for the event (aware of standard rules and any differences for this particular event) - including number of resets (only important at some events) and order of racers
	* Review Event Info sheet - to be taped to the Pit Boss table
* Be familiar with the general mechanical functions of the car and any issues that may prevent it from racing
	* Able to explain and troubleshoot car functions
	* Specifications for changing batteries - percentages depending on type
	* For any league or professional racing - be able to explain the car calibration at a detailed level
		* Calibration standards as established in documentation
* Be familiar with the car web interface - how to load models and troubleshoot issues
* Be familiar with DREM (DeepRacer Event Manager) interface and procedures - searching for and loading models
	* Be familiar with fallback procedures in the event of DREM outages and/or connectivity issues - to be implemented by the Pit Crew Lead as necessary
* Be familiar with overall DeepRacer process and messaging
	* Example: What is DeepRacer, what is happening on the track, what is happening on the cars
* Coordinate with Track Boss / Timekeeper / Racers as needed
* Follow process established by Pit Crew Lead for the given event
* Provide feedback on the event and processes to the Pit Crew Lead and/or the post-event survey

### RESPONSIBILITIES

* Arrive early (~15 minutes - on time is late) for your shift as applicable to coordinate with the outgoing shift and check in with the Pit Crew Lead
* Time is critical at most events - the Pit Boss helps keep the pace and moves quickly to keep races moving while loading models, instructing racers, and troubleshooting as necessary
* Verify Pit Boss table has appropriate equipment - (Exact numbers will vary depending on the equipment in use and the event)
	* 3 - 6 DeepRacer cars
	* 2 - 4 Car control tablets
	* LiPo battery tester / Fuel Gauge
	* Spare drive batteries (request additional from mechanic if running low) - as many as possible without the Pit Boss table appearing cluttered
		* Drive batteries are replaced more frequently than compute batteries
		* Compute battery replacement frequency varies depending on version
			* “New” Excitrus batteries (re:Invent 2022) are replaced more frequently than “original ASUS” batteries (approximately ~80%)
			* Push cars to mechanic for compute battery replacement - mechanic in the pit area will pick up
		* Prioritize a clean table no unnecessary equipment to be on the table, no food or drink.
			* Cars and peripherals only as necessary
	* Flash Drives (if not using DREM)
	* Laptop(s) for model loading (if using DREM)
* __Keep the Pit Boss table and track-side environment neat and clear of bags/drinks/food throughout the event__
	* If possible - have a designated storage area for drinks - cabinet next to the track or similar - bags and food should go in the maintenance or storage area as applicable
* Prior to the start of the race - verify cars that will be in use with Mechanic or Pit Crew Lead - test as necessary on track or verify that cars were tested prior to customer racing
* Interact with customers in line and facilitate the model loading and race preparation process - engage with customers and help them have fun with the process
	* Identify if the customer has a model prepared or will be using a sample model
		* Customer models will either be loaded via DREM or flash drives
		* Sample models will be present in DREM and / or already loaded on the car
		* If using DREM - assist customer with model upload to DREM as necessary
	* Verify tablet is connected to the appropriate car and load the model
		* If using DREM - push model from DREM interface; once complete, load model using car interface
		* If using flash drives - plug flash drive into car and model should load onto the car - remove the flash drive and return to customer once complete
			* If model does not appear - check with customer that the models are located in the “models” directory at the root of the flash drive
		* Load the racers model
			* Select the racers model and wait for it to load ~30-40 seconds
			* Once the model is loaded - check functionality by pressing “Start Vehicle” in the car interface (while holding the car in the air or with it placed on a calibration device - start / stop test) - if the wheels spin successfully, the model has loaded and the car is ready to race
		* Verify with the customer that the correct model is ready to race
	* __Instruct the customer on the rules of the race and the car interface prior to handing the tablet over to them__
		* Give the customer a high level overview of the control interface, paying special attention to the start/stop button, and the speed control.
			* The speed control requires multiple taps to speed up or slow down. Long press doesn’t work.
			* Ensure they know there is a manual control tab, but that's used for testing the car, and not racing - it's not accurate or responsive enough
			* Explain you are there to:
				* Help them get the most out of their race run and will advise them to speed up / down the model depending on performance to help them get the best time they can
				* Warn them about aggressive over driving of the model, endangering the track boss through excessive speed can result on their race being curtailed.
				* Define what constitutes an off-track, role of the track boss - and any event specific rules
			* Start / Stop and maximum speed setting
				* Explain that the speed setting is the maximum speed available to the model - the actual speed will be controlled by the inference the car is performing using the loaded model.
			* Provide racing tips and encouragement
				* Recommend to the customer that most successful models start at a slower speed (30-40%) and then raise it gradually as the car successfully completes lap(s) - they should not immediately raise the speed
				* Advise the customer stop the car when it goes off track - this helps the Track Boss retrieve it more quickly
				* Wish the customer good luck and hand them the tablet
* You are the immediate face of DeepRacer to the customer - keep this in mind when interacting with customers / racer and instructing them on the racing process - they will remember the experience they had and you directly impact that
	* Keep “what’s next” in mind - encourage customers to attend the workshop if they haven’t already
	* Help the customer have fun - encourage them and cheer them on
* Monitor the racing with the Track Boss and Timekeeper
* Assist Track Boss and Timekeeper with calling valid laps and/or off-tracks
* Coach the customer as they race - offer advice on adjusting the speed
* If the racer is abusing the equipment
	* Not slowing the speed when the car is crashing repeatedly or running the car hard into walls
	* Making the Track Boss work harder than necessary through over driving a bad model
	* The Track Boss has the primary responsibility to end the current race, but the Pit Boss may also end the current race at their discretion.
		* Work with the Track Boss to first warn, and then disqualify the lap / racer as appropriate - all racers are to be given at least one warning (The fastest way to get a racer to pay attention is to stop timing)
	* Be aware of swapping cars as necessary beyond the alternating for each race - if cars are running for the whole day, they may overheat
* Replace batteries as necessary
	* LiPo batteries should be replaced when they reach ~50-60% charge (roughly every 4-6 races)
		* For a "Final" each racer should have a fresh LiPo battery
	* Compute batteries should be replaced when they reach ~40-50% charge (time varies depending on battery) and more often during any league racing (70-80%). Transfer the car to the mechanic for replacement of the compute battery.
		* “New” (re:invent 2022) batteries show noticeable degradation around 80% - replace at that point for league events or similar (don’t start a new race if the battery is below 80% for league racing)
		* “Original” (ASUS) batteries can be replaced at ~50% (two dots)
	* Check batteries after each car is run on the track and verify state before loading the car with the next racers model
		* Verify LiPo battery percentage (Below 70%, swap it out)
		* Verify compute battery percentage
	* Work with the Mechanic to ensure a supply of charged batteries
	* Verify against event info sheet for each event
* Triage car issues as they arise
	* Minimize troubleshooting track-side to issues that can be resolved quickly
	* Escalate more complex car issues to the Mechanic and/or the Pit Crew Lead as necessary
	* 	If troubleshooting takes more than 60-90 seconds, the car should be transferred to the Mechanic - Pit Bosses should be spending their time with customers and not extensively troubleshooting cars
*  Work with other Pit Crew to proactively resolve any issues as they arise - prioritizing those that prevent racing - and assist in escalation to the Pit Crew Lead as necessary.
*  At the end of your shift, coordinate with the incoming shift and check out with the Pit Crew Lead before you leave Large Events (all events with a Crew Chief are likely large events):
	*  If multiple Pit Crew are assigned to Pit Boss - while one Pit Boss is working with the active racer (on-track) the secondary/tertiary pit bosses will work with loading models for the next racer(s) in line on other cars. Following the completion of the active race, that Pit Boss will work with the next customer in line and the secondary Pit Boss will become the “on-track” Pit Boss.
	*  Queue management is critical in maintaining the flow of racers during a large event - all Pit Bosses need to work together to manage those customers next in line and ensure they are preparing cars and racers to minimize downtime between races. Aim for N+1/+2 cars prepared to race while one car is on the track - secondary car ready for the racer if the first car has an issue.
	*  There may be a secondary Mechanic / Pit Boss assigned to the track-side area during large events to proactively troubleshoot car issues and stock batteries at the Pit Boss table.
	*  For events or races with a known order of racers - load models ahead of time or reference a schedule taped to the Pit Boss table 
	*  Coordinate with the Pit Crew Lead for stanchions/barriers behind the Pit Boss table - if this is not possible or practical, be aware of your surroundings and equipment on the table - thefts can and do occur at large events
	*  In situations where network conditions dictate - the Pit Crew Lead may request that the Pit Bosses minimize the number of devices on the network - if this is the case, only the active car (and associated tablet) and two backups should be powered on at the pit boss table and all other cars/tablets should be powered off
*  If there are no racers in the queue - circulate around the track and engage with customers who walk up to observe the race and explain what DeepRacer is and encourage them to have a go with one of the default models.