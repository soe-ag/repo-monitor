1. account related

[x] After adding the PAT token of the GitHub, the user information should be shown on the home page. But it is not shown. The reason is that the user information is not fetched after adding the token. To fix this issue, we need to fetch the user information after adding the token. We can do this by calling the `fetchUserInfo` function after adding the token. This function will fetch the user information from the GitHub API and update the state with the user information. or refetch if there is no user information when the page is loaded. This way, the user information will be shown on the home page even after adding the token.

[x] way to delete the token
Currently, there is no way to delete the token. To fix this issue, we can add a delete button next to the token input field. When the user clicks the delete button, we can clear the token from the state and also remove it from the local storage. This way, the user can easily delete the token if they want to. but need modal confirmation

2. repository related

[x] for the card, all the buttons are show with icon , not text . use the radix icons.

[x] opening the github repo dont need a button, adding a new link icon beside repo name which can open the github repo in a new tab when clicked.

[x] now there are two buttons for the warning and issues, and repo details which shows same info about that so, one is not needed

[x] why No stack logos detected? in the repo lanaguages there are languages showing for the specific repo, so i just want to show that langauge as a icon in the repo card
